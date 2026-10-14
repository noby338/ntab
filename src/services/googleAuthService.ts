import { ref, computed, watch, nextTick } from 'vue';
import {
  buildAdaptiveExportData,
  resolveAdaptiveImportData,
  applyConfiguration,
  applySettingsToDOM,
  DEFAULT_SETTINGS,
  userSettings,
  columnLayout,
} from './storage';
import { t } from '../locales';
import type { AdaptiveExportPayload, UserSettings } from '../types';

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

export const DEFAULT_GOOGLE_CLIENT_ID = '439583941688-f4knkqkd65rpul6m7hsescmjfhpem8jp.apps.googleusercontent.com';
const STORAGE_KEY_CUSTOM_CLIENT_ID = 'ntab_custom_client_id';

export function getCustomClientId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY_CUSTOM_CLIENT_ID) || '';
  }
  return '';
}

export function setCustomClientId(id: string): void {
  if (typeof window !== 'undefined') {
    if (id.trim()) {
      localStorage.setItem(STORAGE_KEY_CUSTOM_CLIENT_ID, id.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_CLIENT_ID);
    }
  }
}

function loadCachedUser(): GoogleUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email && Number.isFinite(parsed.expiresAt) && parsed.expiresAt > Date.now()) {
        return parsed;
      }
      localStorage.removeItem(STORAGE_KEY_USER);
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
  const clientId = (customClientId || getCustomClientId() || DEFAULT_GOOGLE_CLIENT_ID).trim();

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
    await initializeSignedInBackup(mockUser);
    return { success: true };
  }

  try {
    const redirectUrl = chrome.identity.getRedirectURL();
    const state = crypto.randomUUID();
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
      `state=${encodeURIComponent(state)}&` +
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
    const expectedRedirect = new URL(redirectUrl);
    if (urlObj.origin !== expectedRedirect.origin || urlObj.pathname !== expectedRedirect.pathname || params.get('state') !== state) {
      return { success: false, error: 'Google sign-in response could not be verified. Please sign in again.' };
    }
    if (params.has('error')) {
      return { success: false, error: params.get('error_description') || params.get('error') || 'Google sign-in failed' };
    }
    const token = params.get('access_token');
    const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

    if (!token) {
      return { success: false, error: 'No access token returned' };
    }
    if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
      return { success: false, error: 'Invalid access token expiry returned' };
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

    await initializeSignedInBackup(user);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Google Sign-in failed' };
  }
}

async function initializeSignedInBackup(user: GoogleUser) {
  refreshBackupPreferences();
  const checked = await checkCloudBackup();
  if (checked.success && automaticBackupEnabled.value && !cloudDecisionRequired.value) {
    // Explicit re-login resumes the latest local edits, including edits made
    // after expiry, instead of publishing an older queued snapshot.
    stagePendingBackup(user);
    queueAutomaticBackup(false);
  }
}

export function logoutGoogle(): void {
  saveSession(null);
  cancelAutomaticBackup();
  refreshBackupPreferences();
  remoteBackup.value = null;
  cloudDecisionRequired.value = false;
  syncStatusMessage.value = '';
}

// -------------------------------------------------------------
// Google Drive AppData Cloud Sync
// Stores config directly in the user's private hidden Google Drive appDataFolder
// -------------------------------------------------------------

async function driveError(res: Response): Promise<Error> {
  const body = await res.json().catch(() => null);
  const reason = body?.error?.errors?.[0]?.reason;
  const message = body?.error?.message;
  if (reason === 'insufficientPermissions') {
    return new Error(t('auth.drivePermissionRequired'));
  }
  return new Error(`Google Drive (${res.status}${reason ? `, ${reason}` : ''})${message ? `: ${message}` : ''}`);
}

interface RemoteBackup {
  id: string;
  version?: string;
  modifiedTime?: string;
  revision: string;
}
interface BackupPreferences {
  automatic: boolean;
  baseRevision?: string | null;
  localFingerprint?: string;
  lastBackup?: string;
  lastRestore?: string;
  lastCheck?: number;
  undo?: { settings: UserSettings; columns: string[][]; at: string };
}
interface PendingBackup { payload: AdaptiveExportPayload; fingerprint: string }
type SyncResult = { success: boolean; error?: string; code?: 'no_backup' | 'conflict' | 'busy' };
const PREFS_PREFIX = 'ntab_backup_preferences:';
const PENDING_PREFIX = 'ntab_pending_backup:';
const preferences = ref<BackupPreferences>({ automatic: false });
export const automaticBackupEnabled = computed(() => preferences.value.automatic);
export const lastBackupTime = computed(() => preferences.value.lastBackup || null);
export const lastRestoreTime = computed(() => preferences.value.lastRestore || null);
export const canUndoCloudRestore = computed(() => !!preferences.value.undo);
export const remoteBackup = ref<RemoteBackup | null>(null);
export const cloudDecisionRequired = ref(false);
export const cloudCheckComplete = ref(false);
export const hasUnbackedChanges = computed(() => fingerprint(buildAdaptiveExportData()) !== preferences.value.localFingerprint);
let automaticTimer: ReturnType<typeof setTimeout> | null = null;
let applyingRestore = false;
let controllerStarted = false;

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
function fingerprint(payload: AdaptiveExportPayload): string {
  const { columnWidth: _legacyWidth, ...settings } = payload.settings;
  return JSON.stringify(stable({ settings, layout: payload.layout }));
}
function accountKey(user: GoogleUser): string { return encodeURIComponent(user.id || user.email); }
function readPreferences(user = currentGoogleUser.value): BackupPreferences {
  if (!user) return { automatic: false };
  try { return { automatic: false, ...JSON.parse(localStorage.getItem(PREFS_PREFIX + accountKey(user)) || '{}') }; }
  catch { return { automatic: false }; }
}
function refreshBackupPreferences() { preferences.value = readPreferences(); }
function updatePreferences(user: GoogleUser, patch: Partial<BackupPreferences>) {
  const value = { ...readPreferences(user), ...patch };
  localStorage.setItem(PREFS_PREFIX + accountKey(user), JSON.stringify(value));
  if (currentGoogleUser.value && accountKey(currentGoogleUser.value) === accountKey(user)) preferences.value = value;
}
function validUser(): GoogleUser {
  const user = currentGoogleUser.value;
  if (!user) throw new Error(t('auth.signInRequired'));
  if (user.expiresAt <= Date.now()) {
    saveSession(null);
    cancelAutomaticBackup();
    throw new Error(t('auth.sessionExpired'));
  }
  const cached = loadCachedUser();
  if (!cached || accountKey(cached) !== accountKey(user)) throw new Error(t('auth.accountChanged'));
  return user;
}
function stillSameAccount(user: GoogleUser) {
  const cached = loadCachedUser();
  if (!cached || accountKey(cached) !== accountKey(user)) throw new Error(t('auth.accountChanged'));
}
async function withAccountLock<T>(user: GoogleUser, action: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) throw new Error(t('auth.lockUnavailable'));
  return navigator.locks.request(`ntab-cloud:${accountKey(user)}`, action);
}
function revision(file: { id: string; version?: string; modifiedTime?: string }): string {
  return `${file.id}:${file.version || file.modifiedTime || 'legacy'}`;
}
async function findRemoteBackup(user: GoogleUser): Promise<RemoteBackup | null> {
  if (!isRealExtension) {
    const raw = localStorage.getItem('mock_google_drive_config');
    if (!raw) return null;
    const payload = JSON.parse(raw);
    return { id: 'mock', revision: payload.syncRevision || raw, modifiedTime: payload.exportedAt };
  }
  const query = encodeURIComponent(`name = '${CONFIG_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&orderBy=modifiedTime%20desc&pageSize=100&fields=files(id,version,modifiedTime)`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  if (!res.ok) throw await driveError(res);
  const data = await res.json();
  const files = (data.files || []).filter((file: any) => typeof file.id === 'string');
  files.sort((a: any, b: any) => (b.modifiedTime || '').localeCompare(a.modifiedTime || '') || b.id.localeCompare(a.id));
  const file = files[0];
  return file ? { ...file, revision: revision(file) } : null;
}
function validatePayload(data: any): AdaptiveExportPayload {
  const settings = data?.settings || (typeof data?.theme === 'string' ? data : null);
  const layout = data?.layout || data?.columns;
  const validEntry = (entry: any) => typeof entry === 'string' || (entry && typeof entry === 'object' &&
    [entry.id, entry.rootId, entry.specialId, entry.title, entry.path].some(value => typeof value === 'string'));
  if (!settings || typeof settings !== 'object' || Array.isArray(settings) ||
      !Array.isArray(layout) || !layout.every((col: any) => Array.isArray(col) && col.every(validEntry))) {
    throw new Error(t('auth.invalidCloudConfig'));
  }
  return { ...data, settings, layout };
}

async function downloadBackup(user: GoogleUser, file: RemoteBackup): Promise<AdaptiveExportPayload> {
  if (!isRealExtension) return validatePayload(JSON.parse(localStorage.getItem('mock_google_drive_config') || 'null'));
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  if (!res.ok) throw await driveError(res);
  return validatePayload(await res.json());
}
function markCloudChoice(file: RemoteBackup | null) {
  remoteBackup.value = file;
  cloudDecisionRequired.value = true;
  syncStatusMessage.value = t(file ? 'auth.cloudChoiceRequired' : 'auth.cloudMissingChoice');
  cancelAutomaticBackup();
}

// Checking never applies settings and never creates a backup implicitly.
export async function checkCloudBackup(): Promise<SyncResult> {
  if (isSyncing.value) return { success: false, code: 'busy' };
  isSyncing.value = true;
  cloudCheckComplete.value = false;
  try {
    const user = validUser();
    return await withAccountLock(user, async () => {
      const file = await findRemoteBackup(user);
      stillSameAccount(user);
      remoteBackup.value = file;
      const prefs = readPreferences(user);
      updatePreferences(user, { lastCheck: Date.now() });
      if (file && file.revision !== prefs.baseRevision) {
        const payload = await downloadBackup(user, file);
        stillSameAccount(user);
        if (fingerprint(payload) === fingerprint(buildAdaptiveExportData())) {
          updatePreferences(user, { baseRevision: file.revision, localFingerprint: fingerprint(buildAdaptiveExportData()) });
          cloudDecisionRequired.value = false;
          syncStatusMessage.value = t('auth.synced');
        } else markCloudChoice(file);
      } else if (!file && prefs.baseRevision) {
        markCloudChoice(null);
      } else {
        cloudDecisionRequired.value = false;
        syncStatusMessage.value = t(file ? (hasUnbackedChanges.value ? 'auth.pendingChanges' : 'auth.synced') : 'auth.noCloudBackup');
      }
      cloudCheckComplete.value = true;
      return { success: true };
    });
  } catch (err: any) {
    cloudDecisionRequired.value = true;
    syncStatusMessage.value = `${t('auth.checkFailed')}: ${err.message}`;
    return { success: false, error: err.message };
  } finally { isSyncing.value = false; }
}

// New backups are immutable files. A simultaneous upload can change which
// version is newest, but cannot destroy the other device's configuration.
async function uploadBackup(user: GoogleUser, payload: AdaptiveExportPayload): Promise<RemoteBackup> {
  const exported = { ...payload, exportedAt: new Date().toISOString(), syncRevision: crypto.randomUUID() };
  if (!isRealExtension) {
    localStorage.setItem('mock_google_drive_config', JSON.stringify(exported));
    return { id: 'mock', revision: exported.syncRevision, modifiedTime: exported.exportedAt };
  }
  const boundary = `ntab_${crypto.randomUUID()}`;
  const body = `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: CONFIG_FILE_NAME, parents: ['appDataFolder'] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` + JSON.stringify(exported) + `\r\n--${boundary}--`;
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,version,modifiedTime', {
    method: 'POST', headers: { Authorization: `Bearer ${user.accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  });
  if (!res.ok) throw await driveError(res);
  const file = await res.json();
  if (!file?.id) throw new Error(t('auth.invalidCloudConfig'));
  return { ...file, revision: revision(file) };
}

export async function backupToGoogleCloud(options: { automatic?: boolean; confirmedRevision?: string | null } = {}): Promise<SyncResult> {
  if (isSyncing.value) return { success: false, code: 'busy' };
  isSyncing.value = true;
  syncStatusMessage.value = t('auth.syncingBackup');
  try {
    const user = validUser();
    return await withAccountLock(user, async () => {
      const prefs = readPreferences(user);
      if (options.automatic && !prefs.automatic) return { success: false };
      const pendingRaw = localStorage.getItem(PENDING_PREFIX + accountKey(user));
      if (options.automatic && !pendingRaw) return { success: true };
      const pending: PendingBackup = options.automatic && pendingRaw ? JSON.parse(pendingRaw) : stagePendingBackup(user);
      if (options.automatic && pending.fingerprint === prefs.localFingerprint) {
        syncStatusMessage.value = t('auth.synced');
        return { success: true };
      }
      const file = await findRemoteBackup(user);
      stillSameAccount(user);
      const actualRevision = file?.revision || null;
      const expectedRevision = options.confirmedRevision !== undefined ? options.confirmedRevision : prefs.baseRevision ?? null;
      if (actualRevision !== expectedRevision) {
        markCloudChoice(file);
        return { success: false, code: 'conflict', error: syncStatusMessage.value };
      }
      const freshPrefs = readPreferences(user);
      if (options.automatic && !freshPrefs.automatic) return { success: false };
      // Read again after network I/O so a newer edit in another tab is included.
      const latestPending: PendingBackup = options.automatic
        ? JSON.parse(localStorage.getItem(PENDING_PREFIX + accountKey(user)) || JSON.stringify(pending))
        : pending;
      stillSameAccount(user);
      const uploaded = await uploadBackup(user, latestPending.payload);
      updatePreferences(user, { baseRevision: uploaded.revision, localFingerprint: latestPending.fingerprint, lastBackup: new Date().toLocaleString() });
      const latest = await findRemoteBackup(user);
      stillSameAccount(user);
      recordSyncTime();
      cloudCheckComplete.value = true;
      if (latest && latest.revision !== uploaded.revision) {
        markCloudChoice(latest);
        return { success: false, code: 'conflict', error: syncStatusMessage.value };
      }
      remoteBackup.value = uploaded;
      cloudDecisionRequired.value = false;
      syncStatusMessage.value = t('auth.backupSuccess');
      return { success: true };
    });
  } catch (err: any) {
    syncStatusMessage.value = `${t('auth.backupFailed')}: ${err.message}`;
    return { success: false, error: err.message };
  } finally {
    isSyncing.value = false;
    if (options.automatic && automaticBackupEnabled.value && !cloudDecisionRequired.value && hasUnbackedChanges.value && currentGoogleUser.value) {
      // Do not continually retry network errors; a new edit/online event resumes.
      if (syncStatusMessage.value === t('auth.backupSuccess')) queueAutomaticBackup(false);
    }
  }
}

export async function restoreFromGoogleCloud(confirmedRevision?: string): Promise<SyncResult> {
  if (!confirmedRevision) return { success: false, error: t('auth.restoreConfirmationRequired') };
  if (isSyncing.value) return { success: false, code: 'busy' };
  isSyncing.value = true;
  cancelAutomaticBackup();
  syncStatusMessage.value = t('auth.pullingBackup');
  try {
    const user = validUser();
    return await withAccountLock(user, async () => {
      const file = await findRemoteBackup(user);
      if (!file) return { success: false, code: 'no_backup', error: t('auth.noCloudBackup') };
      if (file.revision !== confirmedRevision) {
        markCloudChoice(file);
        return { success: false, code: 'conflict', error: syncStatusMessage.value };
      }
      const payload = await downloadBackup(user, file);
      const latest = await findRemoteBackup(user);
      stillSameAccount(user);
      if (latest?.revision !== file.revision) {
        markCloudChoice(latest);
        return { success: false, code: 'conflict', error: syncStatusMessage.value };
      }
      // Save exact local IDs for undo rather than matching a portable export.
      updatePreferences(user, { undo: { settings: JSON.parse(JSON.stringify(userSettings.value)), columns: JSON.parse(JSON.stringify(columnLayout.value.columns)), at: new Date().toISOString() } });
      const { settings, columns } = resolveAdaptiveImportData(payload);
      applyingRestore = true;
      try {
        await applyConfiguration(settings, columns);
        await nextTick();
      } finally { applyingRestore = false; }
      updatePreferences(user, { baseRevision: file.revision, localFingerprint: fingerprint(buildAdaptiveExportData()), lastRestore: new Date().toLocaleString() });
      localStorage.removeItem(PENDING_PREFIX + accountKey(user));
      remoteBackup.value = file;
      cloudDecisionRequired.value = false;
      cloudCheckComplete.value = true;
      recordSyncTime();
      syncStatusMessage.value = t('auth.restoreSuccess');
      return { success: true };
    });
  } catch (err: any) {
    syncStatusMessage.value = `${t('auth.restoreFailed')}: ${err.message}`;
    return { success: false, error: err.message };
  } finally { isSyncing.value = false; }
}

export async function undoCloudRestore(): Promise<SyncResult> {
  if (isSyncing.value) return { success: false, code: 'busy' };
  const user = currentGoogleUser.value;
  if (!user) return { success: false };
  cancelAutomaticBackup();
  isSyncing.value = true;
  try {
    return await withAccountLock(user, async () => {
      const snapshot = readPreferences(user).undo;
      if (!snapshot) return { success: false };
      // Undo is local-only; pause automatic backup to avoid publishing the undo.
      updatePreferences(user, { automatic: false });
      applyingRestore = true;
      try {
        await applyConfiguration(snapshot.settings, snapshot.columns);
        await nextTick();
      } finally { applyingRestore = false; }
      updatePreferences(user, { undo: undefined });
      stagePendingBackup(user);
      syncStatusMessage.value = t('auth.undoRestoreSuccess');
      return { success: true };
    });
  } catch (err: any) { syncStatusMessage.value = err.message; return { success: false, error: err.message }; }
  finally { isSyncing.value = false; }
}

function stagePendingBackup(user: GoogleUser): PendingBackup {
  const payload = buildAdaptiveExportData();
  const pending = { payload, fingerprint: fingerprint(payload) };
  localStorage.setItem(PENDING_PREFIX + accountKey(user), JSON.stringify(pending));
  return pending;
}
function cancelAutomaticBackup() {
  if (automaticTimer) clearTimeout(automaticTimer);
  automaticTimer = null;
}
function queueAutomaticBackup(stage = true) {
  cancelAutomaticBackup();
  const user = currentGoogleUser.value;
  if (!user || !automaticBackupEnabled.value || cloudDecisionRequired.value || !cloudCheckComplete.value) return;
  const existing = localStorage.getItem(PENDING_PREFIX + accountKey(user));
  const pending: PendingBackup = stage || !existing ? stagePendingBackup(user) : JSON.parse(existing);
  if (pending.fingerprint === readPreferences(user).localFingerprint) return;
  const account = accountKey(user);
  automaticTimer = setTimeout(() => {
    automaticTimer = null;
    if (currentGoogleUser.value && accountKey(currentGoogleUser.value) === account) void backupToGoogleCloud({ automatic: true });
  }, 10_000);
}
export async function setAutomaticBackup(enabled: boolean) {
  const user = currentGoogleUser.value;
  if (!user) return;
  updatePreferences(user, { automatic: enabled });
  cancelAutomaticBackup();
  if (enabled) {
    const checked = await checkCloudBackup();
    if (checked.success && !cloudDecisionRequired.value) queueAutomaticBackup(false);
  }
}

// Runs while a NTab page is open; pending edits persist across page closure.
export function startCloudBackupController(): () => void {
  if (controllerStarted || typeof window === 'undefined') return () => {};
  controllerStarted = true;
  cancelAutomaticBackup();
  refreshBackupPreferences();
  const stopWatch = watch(() => fingerprint(buildAdaptiveExportData()), () => {
    if (applyingRestore) return;
    const user = currentGoogleUser.value;
    if (user) stagePendingBackup(user);
    if (user && !isSyncing.value && !cloudDecisionRequired.value) {
      syncStatusMessage.value = t(hasUnbackedChanges.value ? 'auth.pendingChanges' : 'auth.synced');
    }
    queueAutomaticBackup(false);
  }, { flush: 'post' });
  const checkAndResume = async (force = false) => {
    refreshBackupPreferences();
    const user = currentGoogleUser.value;
    if (!user || isSyncing.value) return;
    if (!force && (!automaticBackupEnabled.value || Date.now() - (readPreferences(user).lastCheck || 0) < 55_000)) return;
    const result = await checkCloudBackup();
    if (result.success && automaticBackupEnabled.value && !cloudDecisionRequired.value) queueAutomaticBackup(false);
  };
  const onStorage = async (event: StorageEvent) => {
    if (event.key === STORAGE_KEY_USER) {
      cancelAutomaticBackup();
      currentGoogleUser.value = loadCachedUser();
      refreshBackupPreferences();
      cloudCheckComplete.value = false;
      cloudDecisionRequired.value = true;
    } else if (event.key?.startsWith(PREFS_PREFIX)) {
      const previousSnapshot = preferences.value.undo?.at;
      refreshBackupPreferences();
      if (!automaticBackupEnabled.value || preferences.value.undo?.at !== previousSnapshot) cancelAutomaticBackup();
    }
    else if (event.newValue && (event.key === 'ntab_settings' || event.key === 'ntab_columns')) {
      try {
        const value = JSON.parse(event.newValue);
        applyingRestore = true;
        if (event.key === 'ntab_settings' && value && !Array.isArray(value)) {
          userSettings.value = { ...DEFAULT_SETTINGS, ...value };
          applySettingsToDOM(userSettings.value);
        } else if (event.key === 'ntab_columns' && Array.isArray(value)) {
          columnLayout.value = { columns: value.filter(col => Array.isArray(col) && col.length > 0) };
        }
        await nextTick();
      } catch { /* Ignore malformed local cache events. */ }
      finally { applyingRestore = false; }
    }
  };
  const onOnline = () => { void checkAndResume(true); };
  window.addEventListener('storage', onStorage);
  window.addEventListener('online', onOnline);
  const poll = setInterval(() => { void checkAndResume(); }, 60_000);
  void checkAndResume(true);
  return () => {
    controllerStarted = false;
    stopWatch();
    clearInterval(poll);
    cancelAutomaticBackup();
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('online', onOnline);
  };
}
