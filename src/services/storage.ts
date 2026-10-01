import { ref, watch, computed } from 'vue';
import type { UserSettings, ColumnLayout, BookmarkItem, AdaptiveExportPayload, AdaptiveColumnEntry } from '../types';
import { folderMap, getFolderPath, findFolderByPathOrTitle } from './bookmarks';

export const DEFAULT_SETTINGS: UserSettings = {
  language: 'auto',
  theme: 'system',
  openInNewTab: true,
  fontSize: 14,
  rowHeight: 32,
  hoverDuration: 75,
  columnGap: 20,
  columnWidth: 25,
  columnAlign: 'center',
  cardRadius: 16,
  backdropBlur: 16,
  clockFormat: '24h',
  clockShowSeconds: false,
  hiddenBookmarkIds: [],
  hiddenFolderIds: [],
  showApps: true,
  compactHeader: false,
  hideBookmarkIcons: false,
  showTopSites: true,
  showRecentlyClosed: true,
  showRecentlyDeleted: true,
  confirmBeforeDelete: true,
  topSitesCount: 8,
  recentlyClosedCount: 8,
  showClock: true,
  showSearch: true,
  defaultSearchEngine: 'google',
  customSearchEngines: [],
  customCss: '',
};

export function removeFromColumnLayout(folderId: string): void {
  const cols = columnLayout.value.columns.map((c) => c.filter((id) => id !== folderId));
  saveColumnLayout({ columns: cols });
}

export function removeColumn(colIndex: number): void {
  const cols = [...columnLayout.value.columns.map((c) => [...c])];
  cols.splice(colIndex, 1);
  saveColumnLayout({ columns: cols });
}

export function addToColumnLayout(folderId: string, colIndex: number, rowIndex?: number): void {
  const cols = [...columnLayout.value.columns.map((c) => [...c])];
  for (let c = 0; c < cols.length; c++) {
    const col = cols[c];
    if (col) {
      cols[c] = col.filter((id) => id !== folderId);
    }
  }
  const targetCol = cols[colIndex] || [];
  if (!cols[colIndex]) cols[colIndex] = targetCol;
  if (rowIndex !== undefined) {
    targetCol.splice(rowIndex, 0, folderId);
  } else {
    targetCol.push(folderId);
  }
  const cleaned = cols.filter((c) => c.length > 0);
  saveColumnLayout({ columns: cleaned });
}

export function hideBookmark(id: string): void {
  const current = new Set(userSettings.value.hiddenBookmarkIds || []);
  current.add(id);
  saveSettings({ hiddenBookmarkIds: Array.from(current) });
}

export function unhideBookmark(id: string): void {
  const current = new Set(userSettings.value.hiddenBookmarkIds || []);
  current.delete(id);
  saveSettings({ hiddenBookmarkIds: Array.from(current) });
}

export function hideFolder(id: string): void {
  const current = new Set(userSettings.value.hiddenFolderIds || []);
  current.add(id);
  saveSettings({ hiddenFolderIds: Array.from(current) });
  removeFromColumnLayout(id);
}

export function unhideFolder(id: string): void {
  const current = new Set(userSettings.value.hiddenFolderIds || []);
  current.delete(id);
  const bmSet = new Set(userSettings.value.hiddenBookmarkIds || []);
  bmSet.delete(id);
  saveSettings({
    hiddenFolderIds: Array.from(current),
    hiddenBookmarkIds: Array.from(bmSet),
  });

  const cols = [...columnLayout.value.columns.map((c) => [...c])];
  const exists = cols.some((col) => col.includes(id));
  if (!exists) {
    if (cols.length > 0 && cols[0]) {
      cols[0].push(id);
    } else {
      cols.push([id]);
    }
    saveColumnLayout({ columns: cols });
  }
}

export function unhideAllFolders(): void {
  const allHidden = [...(userSettings.value.hiddenFolderIds || [])];
  const bmSet = new Set(userSettings.value.hiddenBookmarkIds || []);
  for (const id of allHidden) {
    bmSet.delete(id);
  }
  saveSettings({
    hiddenFolderIds: [],
    hiddenBookmarkIds: Array.from(bmSet),
  });

  const cols = [...columnLayout.value.columns.map((c) => [...c])];
  for (const id of allHidden) {
    const exists = cols.some((col) => col.includes(id));
    if (!exists) {
      if (cols.length > 0 && cols[0]) {
        cols[0].push(id);
      } else {
        cols.push([id]);
      }
    }
  }
  saveColumnLayout({ columns: cols });
}

export const activeFolderMenuId = ref<string | null>(null);

if (typeof window !== 'undefined') {
  window.addEventListener('click', () => {
    activeFolderMenuId.value = null;
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      activeFolderMenuId.value = null;
    }
  });
}

export function unhideAllBookmarks(): void {
  saveSettings({ hiddenBookmarkIds: [] });
}

export function toggleFolderVisibility(folderId: string): void {
  const current = new Set(userSettings.value.hiddenFolderIds || []);
  const willShow = current.has(folderId);

  if (willShow) {
    current.delete(folderId);
    const cols = [...columnLayout.value.columns.map((c) => [...c])];
    const exists = cols.some((col) => col.includes(folderId));
    if (!exists) {
      if (cols.length > 0) {
        cols[0]?.push(folderId);
      } else {
        cols.push([folderId]);
      }
      saveColumnLayout({ columns: cols });
    }
  } else {
    current.add(folderId);
  }
  saveSettings({ hiddenFolderIds: Array.from(current) });
}

export function setSpecialWidgetVisible(
  id: 'top_sites' | 'recently_closed' | 'apps' | 'recently_deleted',
  visible: boolean
): void {
  if (id === 'top_sites') {
    userSettings.value.showTopSites = visible;
  } else if (id === 'recently_closed') {
    userSettings.value.showRecentlyClosed = visible;
  } else if (id === 'apps') {
    userSettings.value.showApps = visible;
  } else if (id === 'recently_deleted') {
    userSettings.value.showRecentlyDeleted = visible;
  }
  saveSettings({
    showTopSites: userSettings.value.showTopSites,
    showRecentlyClosed: userSettings.value.showRecentlyClosed,
    showApps: userSettings.value.showApps,
    showRecentlyDeleted: userSettings.value.showRecentlyDeleted,
  });

  const cols = [...columnLayout.value.columns.map((c) => [...c])];
  const exists = cols.some((col) => col.includes(id));

  if (visible) {
    if (!exists) {
      if (cols.length > 1) {
        cols[cols.length - 1]?.push(id);
      } else if (cols.length === 1) {
        cols[0]?.push(id);
      } else {
        cols.push([id]);
      }
      saveColumnLayout({ columns: cols });
    }
  } else {
    if (exists) {
      const filtered = cols.map((col) => col.filter((item) => item !== id));
      saveColumnLayout({ columns: filtered });
    }
  }
}

function getInitialSettings(): UserSettings {
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('ntab_settings');
      if (local) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
      }
    } catch {}
  }
  return { ...DEFAULT_SETTINGS };
}

function getInitialColumns(): ColumnLayout {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('ntab_columns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { columns: parsed };
        }
      }
    } catch {}
  }
  return { columns: [] };
}

function getInitialCollapsed(): Set<string> {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('ntab_collapsed');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch {}
  }
  return new Set();
}

export const userSettings = ref<UserSettings>(getInitialSettings());
export const columnLayout = ref<ColumnLayout>(getInitialColumns());
export const standaloneFolderIds = computed(() => {
  const set = new Set<string>();
  for (const col of columnLayout.value.columns) {
    for (const id of col) {
      set.add(id);
    }
  }
  return set;
});
export const collapsedFolders = ref<Set<string>>(getInitialCollapsed());

if (typeof window !== 'undefined') {
  applySettingsToDOM(userSettings.value);
}

export function buildAdaptiveExportData(): AdaptiveExportPayload {
  const layout = columnLayout.value.columns.map((col) => {
    return col.map((id) => {
      if (id === 'top_sites' || id === 'recently_closed' || id === 'apps' || id === 'recently_deleted') {
        return { specialId: id as 'top_sites' | 'recently_closed' | 'apps' | 'recently_deleted' };
      }
      if (id === '1' || id === '2') {
        return { rootId: id as '1' | '2', title: id === '1' ? 'Bookmarks Bar' : 'Other Bookmarks' };
      }
      const folder = folderMap.value.get(id);
      if (folder) {
        return {
          id,
          title: folder.title,
          path: getFolderPath(id),
        };
      }
      return id;
    });
  });

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: { ...userSettings.value },
    layout,
  };
}

export function resolveAdaptiveImportData(data: any): { settings: UserSettings; columns: string[][] } {
  const incomingSettings = data.settings || (data.theme ? data : {});
  const mergedSettings: UserSettings = {
    ...DEFAULT_SETTINGS,
    ...incomingSettings,
  };

  const rawColumns = data.layout || data.columns || [];
  const resolvedCols: string[][] = [];

  if (Array.isArray(rawColumns)) {
    for (const rawCol of rawColumns) {
      if (!Array.isArray(rawCol)) continue;
      const colItems: string[] = [];
      for (const entry of rawCol) {
        if (typeof entry === 'string') {
          if (entry === 'top_sites' || entry === 'recently_closed' || entry === 'apps' || entry === '1' || entry === '2') {
            colItems.push(entry);
          } else if (folderMap.value.has(entry)) {
            colItems.push(entry);
          } else {
            const matched = findFolderByPathOrTitle(undefined, entry);
            if (matched) colItems.push(matched);
          }
        } else if (typeof entry === 'object' && entry !== null) {
          if (entry.specialId) {
            colItems.push(entry.specialId);
          } else if (entry.rootId) {
            colItems.push(entry.rootId);
          } else if (entry.id && folderMap.value.has(entry.id)) {
            colItems.push(entry.id);
          } else {
            const matched = findFolderByPathOrTitle(entry.path, entry.title);
            if (matched) colItems.push(matched);
          }
        }
      }
      if (colItems.length > 0) {
        resolvedCols.push(colItems);
      }
    }
  }

  const finalColumns = resolvedCols.length > 0 ? resolvedCols : [['1'], ['2'], ['top_sites', 'recently_closed']];
  return {
    settings: mergedSettings,
    columns: finalColumns,
  };
}

const isChromeStorage = typeof chrome !== 'undefined' && !!chrome.storage;

// Load user settings
export async function loadSettings(): Promise<UserSettings> {
  if (isChromeStorage && chrome.storage.sync) {
    try {
      const data = await chrome.storage.sync.get(['ntab_settings', 'ntab_collapsed']);
      if (data.ntab_settings) {
        const merged = { ...DEFAULT_SETTINGS, ...data.ntab_settings };
        if (typeof merged.columnWidth === 'number' && merged.columnWidth > 100) {
          merged.columnWidth = 25;
        }
        userSettings.value = merged;
      }
      if (data.ntab_collapsed && Array.isArray(data.ntab_collapsed)) {
        collapsedFolders.value = new Set(data.ntab_collapsed);
      }
    } catch (e) {
      console.warn('[NTab] Error reading chrome.storage.sync:', e);
    }
  } else {
    // localStorage fallback
    const local = localStorage.getItem('ntab_settings');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        if (typeof merged.columnWidth === 'number' && merged.columnWidth > 100) {
          merged.columnWidth = 25;
        }
        userSettings.value = merged;
      } catch {}
    }
    const collapsed = localStorage.getItem('ntab_collapsed');
    if (collapsed) {
      try {
        collapsedFolders.value = new Set(JSON.parse(collapsed));
      } catch {}
    }
  }
  applySettingsToDOM(userSettings.value);
  return userSettings.value;
}

export function applySettingsToDOM(settings: UserSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDarkMedia = window.matchMedia('(prefers-color-scheme: dark)').matches;

  root.classList.remove(
    'dark',
    'theme-nord',
    'theme-catppuccin',
    'theme-tokyo-night',
    'theme-cream',
    'theme-sepia'
  );

  if (settings.theme === 'system') {
    if (isDarkMedia) root.classList.add('dark');
  } else if (settings.theme === 'dark') {
    root.classList.add('dark');
  } else if (settings.theme === 'light') {
    void 0;
  } else if (settings.theme === 'cream') {
    root.classList.add('theme-cream');
  } else if (settings.theme === 'sepia') {
    root.classList.add('dark', 'theme-sepia');
  } else {
    root.classList.add('dark', `theme-${settings.theme}`);
  }

  root.style.setProperty('--bookmark-font-size', `${settings.fontSize}px`);
  root.style.setProperty('--bookmark-row-height', `${settings.rowHeight}px`);
  root.style.setProperty('--hover-duration', `${settings.hoverDuration}ms`);
  root.style.setProperty('--column-width', `${settings.columnWidth}%`);
  root.style.setProperty('--column-gap', `${settings.columnGap}px`);

  if (settings.cardRadius !== undefined) {
    root.style.setProperty('--card-radius', `${settings.cardRadius}px`);
  }
  if (settings.backdropBlur !== undefined) {
    root.style.setProperty('--backdrop-blur', `${settings.backdropBlur}px`);
  }

  const langCode = settings.language === 'auto' 
    ? (typeof navigator !== 'undefined' ? navigator.language : 'zh-CN')
    : settings.language;
  root.setAttribute('lang', langCode);

  let customStyleEl = document.getElementById('ntab-custom-css') as HTMLStyleElement | null;
  if (settings.customCss && settings.customCss.trim()) {
    if (!customStyleEl) {
      customStyleEl = document.createElement('style');
      customStyleEl.id = 'ntab-custom-css';
      document.head.appendChild(customStyleEl);
    }
    customStyleEl.textContent = settings.customCss;
  } else if (customStyleEl) {
    customStyleEl.textContent = '';
  }
}

export function applyTheme(theme: UserSettings['theme']): void {
  applySettingsToDOM({ ...userSettings.value, theme });
}

let saveSettingsTimer: ReturnType<typeof setTimeout> | null = null;
let saveCollapsedTimer: ReturnType<typeof setTimeout> | null = null;

export async function saveSettings(settings: Partial<UserSettings>, immediate = false): Promise<void> {
  userSettings.value = { ...userSettings.value, ...settings };
  applySettingsToDOM(userSettings.value);

  const plain = JSON.parse(JSON.stringify(userSettings.value));
  try {
    localStorage.setItem('ntab_settings', JSON.stringify(plain));
  } catch {}

  if (isChromeStorage && chrome.storage.sync) {
    if (immediate) {
      if (saveSettingsTimer) clearTimeout(saveSettingsTimer);
      try {
        await chrome.storage.sync.set({ ntab_settings: plain });
      } catch (e) {
        console.error('[NTab] Failed to save settings to sync storage:', e);
      }
    } else {
      if (saveSettingsTimer) clearTimeout(saveSettingsTimer);
      saveSettingsTimer = setTimeout(async () => {
        try {
          await chrome.storage.sync.set({ ntab_settings: plain });
        } catch (e) {
          console.error('[NTab] Failed to save settings to sync storage:', e);
        }
      }, 250);
    }
  }
}

// Toggle folder collapse state
export function toggleFolderCollapse(folderId: string): void {
  if (collapsedFolders.value.has(folderId)) {
    collapsedFolders.value.delete(folderId);
  } else {
    collapsedFolders.value.add(folderId);
  }
  // Persist
  const array = Array.from(collapsedFolders.value);
  try {
    localStorage.setItem('ntab_collapsed', JSON.stringify(array));
  } catch {}

  if (isChromeStorage && chrome.storage.sync) {
    if (saveCollapsedTimer) clearTimeout(saveCollapsedTimer);
    saveCollapsedTimer = setTimeout(() => {
      chrome.storage.sync.set({ ntab_collapsed: array }).catch((e) => {
        console.warn('[NTab] Failed to save collapsed state:', e);
      });
    }, 250);
  }
}

// Load column layout
export async function loadColumnLayout(
  availableRoots: BookmarkItem[]
): Promise<ColumnLayout> {
  let savedColumns: string[][] | null = null;

  if (isChromeStorage && chrome.storage.sync) {
    try {
      const data = await chrome.storage.sync.get('ntab_columns');
      if (data.ntab_columns && Array.isArray(data.ntab_columns)) {
        savedColumns = data.ntab_columns;
      }
    } catch (e) {
      console.warn('[NTab] Error reading columns:', e);
    }
  } else {
    const raw = localStorage.getItem('ntab_columns');
    if (raw) {
      try {
        savedColumns = JSON.parse(raw);
      } catch {}
    }
  }

  // Sanitize and reconcile with current actual folders
  const allKnownIds = new Set<string>();
  for (const root of availableRoots) {
    allKnownIds.add(root.id);
  }
  for (const [id] of folderMap.value) {
    allKnownIds.add(id);
  }
  allKnownIds.add('top_sites');
  allKnownIds.add('recently_closed');
  allKnownIds.add('apps');
  allKnownIds.add('recently_deleted');

  if (savedColumns && savedColumns.length > 0) {
    // Prune deleted folder IDs and remove empty columns
    const sanitized: string[][] = [];
    const usedIds = new Set<string>();

    for (const col of savedColumns) {
      const validCol = col.filter((id) => allKnownIds.has(id));
      sanitized.push(validCol);
      validCol.forEach((id) => usedIds.add(id));
    }

    // Add any root folders that are not in the layout yet
    for (const root of availableRoots) {
      if (!usedIds.has(root.id)) {
        if (sanitized.length === 0) sanitized.push([]);
        const firstCol = sanitized[0];
        if (firstCol) firstCol.push(root.id);
        usedIds.add(root.id);
      }
    }

    if (userSettings.value.showApps && !usedIds.has('apps')) {
      if (sanitized.length > 0) {
        sanitized[0]?.unshift('apps');
      } else {
        sanitized.push(['apps']);
      }
    }

    if (userSettings.value.showTopSites && !usedIds.has('top_sites')) {
      if (sanitized.length > 1) {
        const targetCol = sanitized[sanitized.length - 1];
        if (targetCol) targetCol.unshift('top_sites');
      } else if (sanitized.length === 1) {
        sanitized[0]?.unshift('top_sites');
      } else {
        sanitized.push(['top_sites']);
      }
    }

    if (userSettings.value.showRecentlyClosed && !usedIds.has('recently_closed')) {
      if (sanitized.length > 1) {
        const targetCol = sanitized[sanitized.length - 1];
        if (targetCol) targetCol.push('recently_closed');
      } else if (sanitized.length === 1) {
        sanitized[0]?.push('recently_closed');
      } else {
        sanitized.push(['recently_closed']);
      }
    }

    if (userSettings.value.showRecentlyDeleted && !usedIds.has('recently_deleted')) {
      if (sanitized.length > 1) {
        const targetCol = sanitized[sanitized.length - 1];
        if (targetCol) targetCol.push('recently_deleted');
      } else if (sanitized.length === 1) {
        sanitized[0]?.push('recently_deleted');
      } else {
        sanitized.push(['recently_deleted']);
      }
    }

    columnLayout.value = { columns: sanitized };
  } else {
    // Generate fresh default layout
    const cols: string[][] = [];
    const root0 = availableRoots[0];
    if (root0) {
      cols.push([root0.id]); // Bookmarks Bar
    }
    const root1 = availableRoots[1];
    if (root1) {
      cols.push([root1.id]); // Other Bookmarks
    }
    // Special folder column
    const specials: string[] = [];
    if (userSettings.value.showApps) specials.push('apps');
    if (userSettings.value.showTopSites) specials.push('top_sites');
    if (userSettings.value.showRecentlyClosed) specials.push('recently_closed');
    if (userSettings.value.showRecentlyDeleted) specials.push('recently_deleted');
    if (specials.length > 0) cols.push(specials);

    columnLayout.value = { columns: cols.length > 0 ? cols : [['1']] };
  }

  return columnLayout.value;
}

// Save column layout
export async function saveColumnLayout(layout: ColumnLayout): Promise<void> {
  columnLayout.value = { columns: layout.columns };
  const plain = JSON.parse(JSON.stringify(layout.columns));

  if (isChromeStorage && chrome.storage.sync) {
    try {
      await chrome.storage.sync.set({ ntab_columns: plain });
    } catch (e) {
      console.error('[NTab] Error saving column layout:', e);
    }
  } else {
    localStorage.setItem('ntab_columns', JSON.stringify(plain));
  }
}

// Listen to system color scheme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (userSettings.value.theme === 'system') {
      applyTheme('system');
    }
  });
}
