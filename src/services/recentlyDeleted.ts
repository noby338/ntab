import { ref } from 'vue';
import type { BookmarkItem } from '../types';
import { loadBookmarks } from './bookmarks';

export interface DeletedItem {
  id: string;
  originalId?: string;
  title: string;
  url?: string;
  parentId?: string;
  parentTitle?: string;
  deletedAt: number;
  isFolder: boolean;
  children?: DeletedItem[];
}

const STORAGE_KEY = 'ntab_recently_deleted';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const recentlyDeletedList = ref<DeletedItem[]>([]);

const isChromeStorage = typeof chrome !== 'undefined' && Boolean(chrome.storage && chrome.storage.local);

function sanitizeDeletedItems(items: DeletedItem[]): DeletedItem[] {
  const now = Date.now();
  return items.filter((item) => now - item.deletedAt <= SEVEN_DAYS_MS);
}

export async function loadRecentlyDeleted(): Promise<DeletedItem[]> {
  let loaded: DeletedItem[] = [];

  if (isChromeStorage) {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      if (data[STORAGE_KEY] && Array.isArray(data[STORAGE_KEY])) {
        loaded = data[STORAGE_KEY];
      }
    } catch (e) {
      console.warn('[NTab] Failed to read recently deleted from chrome.storage:', e);
    }
  } else if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) loaded = parsed;
      } catch {}
    }
  }

  const cleaned = sanitizeDeletedItems(loaded);
  recentlyDeletedList.value = cleaned;

  // If items expired, save back cleaned list
  if (cleaned.length !== loaded.length) {
    await saveRecentlyDeleted(cleaned);
  }

  return cleaned;
}

async function saveRecentlyDeleted(items: DeletedItem[]): Promise<void> {
  const cleaned = sanitizeDeletedItems(items);
  recentlyDeletedList.value = cleaned;

  if (isChromeStorage) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: cleaned });
    } catch (e) {
      console.warn('[NTab] Failed to save recently deleted to chrome.storage:', e);
    }
  } else if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    } catch {}
  }
}

function convertBookmarkToDeleted(node: BookmarkItem): DeletedItem {
  const isFolder = Array.isArray(node.children);
  return {
    id: `trash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    originalId: node.id,
    title: node.title || (node.url ? node.url : '未命名书签'),
    url: node.url,
    parentId: node.parentId,
    deletedAt: Date.now(),
    isFolder,
    children: node.children ? node.children.map(convertBookmarkToDeleted) : undefined,
  };
}

export async function addRecentlyDeleted(itemOrItems: BookmarkItem | BookmarkItem[]): Promise<void> {
  const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
  if (items.length === 0) return;

  const current = [...recentlyDeletedList.value];
  const newDeleted = items.map(convertBookmarkToDeleted);

  // Prepend newest deletions to the top
  const merged = [...newDeleted, ...current];
  await saveRecentlyDeleted(merged);
}

export async function permanentlyDelete(trashId: string): Promise<void> {
  const filtered = recentlyDeletedList.value.filter((item) => item.id !== trashId);
  await saveRecentlyDeleted(filtered);
}

export async function clearRecentlyDeleted(): Promise<void> {
  await saveRecentlyDeleted([]);
}

async function recreateBookmark(item: DeletedItem, targetParentId = '1'): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.bookmarks && chrome.bookmarks.create) {
    if (item.isFolder) {
      const createdFolder = await chrome.bookmarks.create({
        parentId: targetParentId,
        title: item.title,
      });
      if (item.children && createdFolder.id) {
        for (const child of item.children) {
          await recreateBookmark(child, createdFolder.id);
        }
      }
    } else {
      await chrome.bookmarks.create({
        parentId: targetParentId,
        title: item.title,
        url: item.url,
      });
    }
  }
}

export async function restoreBookmark(trashId: string): Promise<boolean> {
  const item = recentlyDeletedList.value.find((i) => i.id === trashId);
  if (!item) return false;

  try {
    const parentId = item.parentId || '1';
    await recreateBookmark(item, parentId);
    await permanentlyDelete(trashId);
    await loadBookmarks();
    return true;
  } catch (err) {
    console.error('[NTab] Failed to restore bookmark:', err);
    // Fallback: try restoring to Bookmarks Bar ('1')
    try {
      await recreateBookmark(item, '1');
      await permanentlyDelete(trashId);
      await loadBookmarks();
      return true;
    } catch (e2) {
      console.error('[NTab] Secondary restore failed:', e2);
      return false;
    }
  }
}

// Initial load on import
if (typeof window !== 'undefined') {
  void loadRecentlyDeleted();
}
