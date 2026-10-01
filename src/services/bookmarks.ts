import { ref, shallowRef } from 'vue';
import type { BookmarkItem } from '../types';
import { addRecentlyDeleted } from './recentlyDeleted';

// Reactive state
export const rawBookmarkTree = shallowRef<BookmarkItem[]>([]);
export const folderMap = ref<Map<string, BookmarkItem>>(new Map());
export const allBookmarksMap = ref<Map<string, BookmarkItem>>(new Map());
export const topSitesList = ref<BookmarkItem[]>([]);
export const recentlyClosedList = ref<BookmarkItem[]>([]);
export const isLoaded = ref(false);

const isChrome = typeof chrome !== 'undefined' && !!chrome.bookmarks;

// Fallback Mock Data for Dev / Non-extension browser testing
const MOCK_BOOKMARKS: BookmarkItem[] = [
  {
    id: '1',
    title: '书签栏 (Bookmarks Bar)',
    children: [
      {
        id: '101',
        parentId: '1',
        title: '常用工具 (Daily Tools)',
        children: [
          { id: '1011', parentId: '101', title: 'GitHub', url: 'https://github.com' },
          { id: '1012', parentId: '101', title: 'V2EX', url: 'https://v2ex.com' },
          { id: '1013', parentId: '101', title: '掘金', url: 'https://juejin.cn' },
          { id: '1014', parentId: '101', title: 'NAS 控制台 (UGREEN)', url: 'http://192.168.31.103' },
        ],
      },
      {
        id: '102',
        parentId: '1',
        title: '开发文档 (Docs)',
        children: [
          { id: '1021', parentId: '102', title: 'Vue.js 官方文档', url: 'https://vuejs.org' },
          { id: '1022', parentId: '102', title: 'Tailwind CSS v4', url: 'https://tailwindcss.com' },
          { id: '1023', parentId: '102', title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
          { id: '1024', parentId: '102', title: 'Chrome Extensions Docs', url: 'https://developer.chrome.com/docs/extensions/' },
        ],
      },
      { id: '103', parentId: '1', title: 'Google', url: 'https://www.google.com' },
      { id: '104', parentId: '1', title: 'YouTube', url: 'https://www.youtube.com' },
      { id: '105', parentId: '1', title: 'ChatGPT', url: 'https://chatgpt.com' },
    ],
  },
  {
    id: '2',
    title: '其他书签 (Other Bookmarks)',
    children: [
      {
        id: '201',
        parentId: '2',
        title: '影音娱乐',
        children: [
          { id: '2011', parentId: '201', title: 'Bilibili', url: 'https://www.bilibili.com' },
          { id: '2012', parentId: '201', title: 'Netflix', url: 'https://www.netflix.com' },
          { id: '2013', parentId: '201', title: 'Spotify', url: 'https://open.spotify.com' },
        ],
      },
      {
        id: '202',
        parentId: '2',
        title: '家庭内网与服务',
        children: [
          { id: '2021', parentId: '202', title: 'Nginx Proxy Manager', url: 'http://192.168.31.103:10081' },
          { id: '2022', parentId: '202', title: '打卡管理系统 (Clock-in)', url: 'http://192.168.31.103:3000' },
          { id: '2023', parentId: '202', title: '动态 DNS (ddns-go)', url: 'http://192.168.31.103:9876' },
        ],
      },
    ],
  },
];

function indexNodes(nodes: BookmarkItem[], fMap: Map<string, BookmarkItem>, allMap: Map<string, BookmarkItem>) {
  for (const node of nodes) {
    allMap.set(node.id, node);
    if (node.children) {
      fMap.set(node.id, node);
      indexNodes(node.children, fMap, allMap);
    }
  }
}

// Fetch all bookmarks
export async function loadBookmarks(): Promise<void> {
  if (!isChrome) {
    // Local Dev Mock
    rawBookmarkTree.value = MOCK_BOOKMARKS;
    const newFMap = new Map<string, BookmarkItem>();
    const newAllMap = new Map<string, BookmarkItem>();
    indexNodes(MOCK_BOOKMARKS, newFMap, newAllMap);
    folderMap.value = newFMap;
    allBookmarksMap.value = newAllMap;
    loadMockTopSites();
    isLoaded.value = true;
    return;
  }

  try {
    const tree = await chrome.bookmarks.getTree();
    const roots = (tree[0]?.children as BookmarkItem[]) || [];
    rawBookmarkTree.value = roots;

    const newFMap = new Map<string, BookmarkItem>();
    const newAllMap = new Map<string, BookmarkItem>();
    indexNodes(roots, newFMap, newAllMap);
    folderMap.value = newFMap;
    allBookmarksMap.value = newAllMap;

    await Promise.all([loadTopSites(), loadRecentlyClosed()]);
    isLoaded.value = true;
  } catch (error) {
    console.error('[NTab] Error loading bookmarks:', error);
  }
}

// Top sites
export async function loadTopSites(max = 12): Promise<void> {
  if (!isChrome || !chrome.topSites) return;
  try {
    const sites = await chrome.topSites.get();
    topSitesList.value = sites.slice(0, max).map((s, idx) => ({
      id: `top-site-${idx}`,
      title: s.title || s.url,
      url: s.url,
      isSpecial: true,
    }));
  } catch (err) {
    console.warn('[NTab] Failed to load top sites:', err);
  }
}

// Recently closed
export async function loadRecentlyClosed(max = 12): Promise<void> {
  if (!isChrome) {
    recentlyClosedList.value = [
      { id: 'closed-1', title: 'Tailwind CSS Documentation', url: 'https://tailwindcss.com/docs', isSpecial: true },
      { id: 'closed-2', title: 'Vue 3 Cheatsheet', url: 'https://vuejs.org', isSpecial: true },
      { id: 'closed-3', title: 'Vite 官方中文文档', url: 'https://cn.vitejs.dev', isSpecial: true },
      { id: 'closed-4', title: 'GitHub: WXT Extension Framework', url: 'https://github.com/wxt-dev/wxt', isSpecial: true },
    ];
    return;
  }

  try {
    const list: BookmarkItem[] = [];

    if (chrome.sessions) {
      const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: max });
      for (const s of sessions) {
        if (s.tab && s.tab.url) {
          list.push({
            id: `closed-tab-${s.tab.sessionId || Math.random()}`,
            title: s.tab.title || s.tab.url,
            url: s.tab.url,
            isSpecial: true,
          });
        } else if (s.window && s.window.tabs) {
          for (const t of s.window.tabs) {
            if (t.url) {
              list.push({
                id: `closed-tab-${t.sessionId || Math.random()}`,
                title: t.title || t.url,
                url: t.url,
                isSpecial: true,
              });
            }
          }
        }
      }
    }

    if (list.length === 0 && chrome.history) {
      const historyItems = await chrome.history.search({ text: '', maxResults: max });
      for (const h of historyItems) {
        if (h.url && !h.url.startsWith('chrome://') && !h.url.startsWith('chrome-extension://')) {
          list.push({
            id: `closed-tab-${h.id || Math.random()}`,
            title: h.title || h.url,
            url: h.url,
            isSpecial: true,
          });
        }
      }
    }

    recentlyClosedList.value = list.slice(0, max);
  } catch (err) {
    console.warn('[NTab] Failed to load recently closed sessions:', err);
  }
}

function loadMockTopSites() {
  topSitesList.value = [
    { id: 'top-1', title: 'GitHub', url: 'https://github.com', isSpecial: true },
    { id: 'top-2', title: 'Google', url: 'https://google.com', isSpecial: true },
    { id: 'top-3', title: 'YouTube', url: 'https://youtube.com', isSpecial: true },
  ];
  recentlyClosedList.value = [
    { id: 'closed-1', title: 'Tailwind CSS Documentation', url: 'https://tailwindcss.com/docs', isSpecial: true },
    { id: 'closed-2', title: 'Vue 3 Cheatsheet', url: 'https://vuejs.org', isSpecial: true },
  ];
}

// Real-time Event Listeners for live sync
let listenersRegistered = false;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedReload() {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    loadBookmarks();
  }, 100);
}

export function setupBookmarkListeners(): void {
  if (!isChrome || listenersRegistered) return;
  listenersRegistered = true;

  chrome.bookmarks.onCreated.addListener(debouncedReload);
  chrome.bookmarks.onRemoved.addListener(debouncedReload);
  chrome.bookmarks.onChanged.addListener(debouncedReload);
  chrome.bookmarks.onMoved.addListener(debouncedReload);
  chrome.bookmarks.onChildrenReordered.addListener(debouncedReload);

  if (chrome.sessions?.onChanged) {
    chrome.sessions.onChanged.addListener(() => loadRecentlyClosed());
  }
}

// Favicon URL resolver with robust fallbacks
export function getFaviconUrl(url?: string): string {
  if (!url) return '';
  if (isChrome) {
    return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`);
  }
  // Fallback for dev mode
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

export function getFolderPath(folderId: string): string {
  const parts: string[] = [];
  let current = folderMap.value.get(folderId);
  while (current) {
    if (current.title) {
      parts.unshift(current.title.trim());
    }
    if (current.parentId && current.parentId !== '0') {
      current = folderMap.value.get(current.parentId);
    } else {
      break;
    }
  }
  return parts.join('/');
}

export function findFolderByPathOrTitle(path?: string, title?: string): string | null {
  if (!path && !title) return null;

  if (path) {
    const cleanPath = path.trim().toLowerCase();
    for (const [id] of folderMap.value) {
      if (getFolderPath(id).toLowerCase() === cleanPath) {
        return id;
      }
    }
  }

  if (title) {
    const cleanTitle = title.trim().toLowerCase();
    for (const [id, item] of folderMap.value) {
      if (item.title && item.title.trim().toLowerCase() === cleanTitle) {
        return id;
      }
    }
  }

  return null;
}

export function isDescendantFolder(sourceId: string, targetId: string): boolean {
  if (sourceId === targetId) return true;
  let current = folderMap.value.get(targetId);
  while (current && current.parentId) {
    if (current.parentId === sourceId) return true;
    current = folderMap.value.get(current.parentId);
  }
  return false;
}

export async function moveBookmark(
  id: string,
  targetParentId: string,
  targetIndex?: number,
  extraData?: { title?: string; url?: string }
): Promise<boolean> {
  if (id.startsWith('top-site-') || id.startsWith('closed-tab-') || id.startsWith('app-')) {
    if (extraData?.url) {
      if (!isChrome) return true;
      try {
        await chrome.bookmarks.create({
          parentId: targetParentId,
          title: extraData.title || extraData.url,
          url: extraData.url,
          ...(targetIndex !== undefined ? { index: targetIndex } : {}),
        });
        await loadBookmarks();
        return true;
      } catch (err) {
        console.error('[NTab] Failed to convert special item to bookmark:', err);
        return false;
      }
    }
    return false;
  }

  if (folderMap.value.has(id) && isDescendantFolder(id, targetParentId)) {
    return false;
  }
  if (!isChrome) {
    function detachNode(nodes: BookmarkItem[], searchId: string): BookmarkItem | null {
      for (let i = 0; i < nodes.length; i++) {
        const item = nodes[i];
        if (item && item.id === searchId) {
          return nodes.splice(i, 1)[0] || null;
        }
        if (item && item.children) {
          const found = detachNode(item.children, searchId);
          if (found) return found;
        }
      }
      return null;
    }

    function attachNode(nodes: BookmarkItem[], pId: string, nodeToAttach: BookmarkItem, index?: number): boolean {
      for (const node of nodes) {
        if (node.id === pId) {
          if (!node.children) node.children = [];
          nodeToAttach.parentId = pId;
          if (index !== undefined) {
            node.children.splice(index, 0, nodeToAttach);
          } else {
            node.children.push(nodeToAttach);
          }
          return true;
        }
        if (node.children) {
          const ok = attachNode(node.children, pId, nodeToAttach, index);
          if (ok) return true;
        }
      }
      return false;
    }

    const detached = detachNode(MOCK_BOOKMARKS, id);
    if (detached) {
      attachNode(MOCK_BOOKMARKS, targetParentId, detached, targetIndex);
      await loadBookmarks();
      return true;
    }
    return true;
  }
  try {
    await chrome.bookmarks.move(id, {
      parentId: targetParentId,
      ...(targetIndex !== undefined ? { index: targetIndex } : {}),
    });
    return true;
  } catch (err) {
    console.error('[NTab] Failed to move bookmark:', err);
    return false;
  }
}

export async function createFolder(parentId: string, title: string): Promise<BookmarkItem | null> {
  if (!isChrome) {
    const newId = `mock-folder-${Date.now()}`;
    const newFolder: BookmarkItem = {
      id: newId,
      parentId,
      title,
      children: [],
    };
    folderMap.value.set(newId, newFolder);
    const parent = folderMap.value.get(parentId);
    if (parent && parent.children) {
      parent.children.push(newFolder);
    }
    return newFolder;
  }
  try {
    const created = await chrome.bookmarks.create({
      parentId,
      title,
    });
    await loadBookmarks();
    return created as BookmarkItem;
  } catch (err) {
    console.error('[NTab] Failed to create folder:', err);
    return null;
  }
}

export async function removeBookmark(id: string, isFolder = false, shouldReload = true): Promise<boolean> {
  const node = allBookmarksMap.value.get(id) || folderMap.value.get(id);
  if (node) {
    void addRecentlyDeleted(node);
  }

  if (!isChrome) {
    folderMap.value.delete(id);
    if (shouldReload) await loadBookmarks();
    return true;
  }
  try {
    if (isFolder) {
      await chrome.bookmarks.removeTree(id);
    } else {
      await chrome.bookmarks.remove(id);
    }
    if (shouldReload) await loadBookmarks();
    return true;
  } catch (err) {
    console.error('[NTab] Failed to remove bookmark:', err);
    return false;
  }
}

export function openUrl(url?: string, newTab = true): void {
  if (!url) return;
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url });
      return;
    }
  }
  if (newTab) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    window.location.href = url;
  }
}

// Batch remove bookmarks / folders
export async function batchRemoveBookmarks(ids: string[]): Promise<number> {
  const nodes = ids
    .map((id) => allBookmarksMap.value.get(id) || folderMap.value.get(id))
    .filter(Boolean) as BookmarkItem[];
  if (nodes.length > 0) {
    void addRecentlyDeleted(nodes);
  }

  let successCount = 0;
  for (const id of ids) {
    const isFolder = folderMap.value.has(id);
    if (!isChrome) {
      folderMap.value.delete(id);
      successCount++;
    } else {
      try {
        if (isFolder) {
          await chrome.bookmarks.removeTree(id);
        } else {
          await chrome.bookmarks.remove(id);
        }
        successCount++;
      } catch (err) {
        console.error('[NTab] Failed to batch remove bookmark:', err);
      }
    }
  }
  await loadBookmarks();
  return successCount;
}

// Update title or URL
export async function updateBookmark(
  id: string,
  changes: { title?: string; url?: string }
): Promise<boolean> {
  if (!isChrome) return true;
  try {
    await chrome.bookmarks.update(id, changes);
    return true;
  } catch (err) {
    console.error('[NTab] Failed to update bookmark:', err);
    return false;
  }
}
