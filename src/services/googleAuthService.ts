import { ref } from 'vue';
import {
  buildAdaptiveExportData,
  resolveAdaptiveImportData,
  saveSettings,
  saveColumnLayout,
} from './storage';

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  expiresAt: number;
}

const STORAGE_KEY_USER = 'ntab_google_user';
const STORAGE_KEY_LAST_SYNC = 'ntab_google_last_sync';
const CONFIG_FILE_NAME = 'ntab_config.json';

// Default OAuth Client ID for NTab extension
// Can be customized by user in advanced settings
export const DEFAULT_GOOGLE_CLIENT_ID = '983675841267-27s4g9v6v9g4q5t4f5v9g4q5t4f5v9g4.apps.googleusercontent.com';

function loadCachedUser(): GoogleUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

function loadLastSyncedTime(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY_LAST_SYNC);
  } catch {
    return null;
  }
}

export const currentGoogleUser = ref<GoogleUser | null>(loadCachedUser());
export const isSyncing = ref(false);
export const lastSyncedTime = ref<string | null>(loadLastSyncedTime());
export const syncStatusMessage = ref<string>('');

function saveSession(user: GoogleUser | null) {
  currentGoogleUser.value = user;
  if (typeof window !== 'undefined') {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch {}
  }
}

function recordSyncTime() {
  const now = new Date().toLocaleString();
  lastSyncedTime.value = now;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, now);
    } catch {}
  }
}

export const isRealExtension =
  typeof chrome !== 'undefined' &&
  !!chrome.identity &&
  typeof location !== 'undefined' &&
  location.protocol === 'chrome-extension:';

export async function loginWithGoogle(customClientId?: string): Promise<{ success: boolean; error?: string }> {
  const clientId = (customClientId || DEFAULT_GOOGLE_CLIENT_ID).trim();

  if (!isRealExtension) {
    const mockUser: GoogleUser = {
      id: 'mock_google_id_123',
      email: 'user@gmail.com',
      name: 'Google User (Dev Mock)',
      picture: 'https://lh3.googleusercontent.com/a/default-user',
      accessToken: 'mock_access_token',
      expiresAt: Date.now() + 3600 * 1000,
    };
    saveSession(mockUser);
    recordSyncTime();
    return { success: true };
  }

  try {
    const redirectUrl = chrome.identity.getRedirectURL();
    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.appdata',
    ];

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=token&` +
      `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `prompt=select_account`;

    const responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true,
        },
        (redirectUri) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (redirectUri) {
            resolve(redirectUri);
          } else {
            reject(new Error('Login cancelled or failed to redirect'));
          }
        }
      );
    });

    // Parse token from fragment #access_token=...&expires_in=...
    const urlObj = new URL(responseUrl);
    const hash = urlObj.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

    if (!token) {
      return { success: false, error: 'No access token returned' };
    }

    // Fetch user profile info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userRes.ok) {
      return { success: false, error: 'Failed to fetch user profile' };
    }

    const userData = await userRes.json();
    const user: GoogleUser = {
      id: userData.sub || userData.id,
      email: userData.email,
      name: userData.name || userData.email.split('@')[0],
      picture: userData.picture,
      accessToken: token,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    saveSession(user);

    // Auto-check if remote configuration exists and restore if needed
    try {
      await restoreFromGoogleCloud();
    } catch {
      // If no remote backup exists yet, upload initial backup
      await backupToGoogleCloud();
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Google Sign-in failed' };
  }
}

export function logoutGoogle(): void {
  saveSession(null);
  syncStatusMessage.value = '';
}

// -------------------------------------------------------------
// Google Drive AppData Cloud Sync
// Stores config directly in the user's private hidden Google Drive appDataFolder
// -------------------------------------------------------------

async function findRemoteConfigFile(token: string): Promise<string | null> {
  const query = encodeURIComponent(`name = '${CONFIG_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  const file = data.files?.[0];
  return file?.id || null;
}

export async function backupToGoogleCloud(): Promise<{ success: boolean; error?: string }> {
  const user = currentGoogleUser.value;
  if (!user) return { success: false, error: 'Not logged in' };

  isSyncing.value = true;
  syncStatusMessage.value = '正在上传备份至谷歌云端...';

  try {
    const payload = buildAdaptiveExportData();
    const jsonString = JSON.stringify(payload);

    if (!isRealExtension) {
      localStorage.setItem('mock_google_drive_config', jsonString);
      recordSyncTime();
      syncStatusMessage.value = '已同步至谷歌云端';
      return { success: true };
    }

    const fileId = await findRemoteConfigFile(user.accessToken);

    if (fileId) {
      // Update existing file via PATCH
      const updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: jsonString,
        }
      );
      if (!updateRes.ok) throw new Error(`Upload failed: ${updateRes.statusText}`);
    } else {
      // Create new file in AppData via multipart POST
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const metadata = {
        name: CONFIG_FILE_NAME,
        parents: ['appDataFolder'],
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        jsonString +
        closeDelim;

      const createRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );
      if (!createRes.ok) throw new Error(`Create failed: ${createRes.statusText}`);
    }

    recordSyncTime();
    syncStatusMessage.value = '配置已安全备份至谷歌云端';
    return { success: true };
  } catch (err: any) {
    syncStatusMessage.value = '云端备份失败';
    return { success: false, error: err?.message || 'Cloud backup failed' };
  } finally {
    isSyncing.value = false;
  }
}

export async function restoreFromGoogleCloud(): Promise<{ success: boolean; error?: string }> {
  const user = currentGoogleUser.value;
  if (!user) return { success: false, error: 'Not logged in' };

  isSyncing.value = true;
  syncStatusMessage.value = '正在从谷歌云端拉取配置...';

  try {
    let jsonContent: any = null;

    if (!isRealExtension) {
      const raw = localStorage.getItem('mock_google_drive_config');
      if (raw) jsonContent = JSON.parse(raw);
    } else {
      const fileId = await findRemoteConfigFile(user.accessToken);
      if (!fileId) {
        return { success: false, error: 'No cloud backup found for this account' };
      }

      const getRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        }
      );
      if (!getRes.ok) throw new Error(`Download failed: ${getRes.statusText}`);
      jsonContent = await getRes.json();
    }

    if (!jsonContent) {
      return { success: false, error: 'Cloud backup is empty' };
    }

    // Apply restored configuration into NTab
    const { settings, columns } = resolveAdaptiveImportData(jsonContent);
    saveSettings(settings);
    saveColumnLayout({ columns });
    recordSyncTime();
    syncStatusMessage.value = '已从云端成功恢复配置';

    return { success: true };
  } catch (err: any) {
    syncStatusMessage.value = '拉取云端配置失败';
    return { success: false, error: err?.message || 'Failed to restore cloud config' };
  } finally {
    isSyncing.value = false;
  }
}
