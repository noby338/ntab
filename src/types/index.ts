export interface BookmarkItem {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  children?: BookmarkItem[];
  dateAdded?: number;
  dateGroupModified?: number;
  unmodifiable?: 'managed';
  isSpecial?: boolean; // e.g. 'top-sites', 'recently-closed'
}

export type ThemeMode =
  | 'system'
  | 'light'
  | 'dark'
  | 'cream'
  | 'sepia'
  | 'nord'
  | 'catppuccin'
  | 'tokyo-night';

export type LanguageCode =
  | 'auto'
  | 'en'
  | 'zh-CN'
  | 'zh-TW'
  | 'ja'
  | 'ko'
  | 'de'
  | 'es'
  | 'fr'
  | 'ru';

export type ClockFormat = '24h' | '12h';

export interface ShortcutBinding {
  key: string;
  code: string;
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

export type ShortcutActionId =
  | 'focusSearch'
  | 'cycleSearchEngine'
  | 'switchEngine1'
  | 'switchEngine2'
  | 'switchEngine3'
  | 'switchEngine4'
  | 'switchEngine5'
  | 'switchEngine6'
  | 'newFolder'
  | 'toggleBatch'
  | 'healthCheck'
  | 'openSettings';

export type UserShortcuts = Record<ShortcutActionId, ShortcutBinding>;

export interface CustomSearchEngine {
  id: string;
  name: string;
  url: string;
  icon?: string;
}

export interface SerializedCardItem {
  id?: string;
  specialId?: 'top_sites' | 'recently_closed' | 'apps';
  rootId?: '1' | '2';
  title?: string;
  path?: string;
}

export type AdaptiveColumnEntry = string | SerializedCardItem;

export interface AdaptiveExportPayload {
  version: number;
  exportedAt: string;
  settings: UserSettings;
  layout?: AdaptiveColumnEntry[][];
}

export interface UserSettings {
  language: LanguageCode;
  theme: ThemeMode;
  openInNewTab: boolean;
  fontSize: number;
  rowHeight: number;
  hoverDuration: number;
  columnGap: number;
  columnWidth: number;
  columnAlign: 'left' | 'center' | 'right';
  cardRadius?: number;
  backdropBlur?: number;
  clockFormat?: ClockFormat;
  clockShowSeconds?: boolean;
  hiddenBookmarkIds: string[];
  hiddenFolderIds: string[];
  showApps: boolean;
  compactHeader: boolean;
  hideBookmarkIcons?: boolean;
  showTopSites: boolean;
  showRecentlyClosed: boolean;
  topSitesCount: number;
  recentlyClosedCount: number;
  showClock: boolean;
  showSearch: boolean;
  defaultSearchEngine: 'google' | 'baidu' | 'bing' | 'github' | 'duckduckgo' | string;
  customSearchEngines?: CustomSearchEngine[];
  shortcuts?: Partial<UserShortcuts>;
  customCss?: string;
}

export interface ColumnLayout {
  columns: string[][]; // 2D array of folder IDs
}

export interface DragItem {
  type: 'bookmark' | 'folder';
  id: string;
  parentId?: string;
  fromColumnIndex?: number;
  fromRowIndex?: number;
}
