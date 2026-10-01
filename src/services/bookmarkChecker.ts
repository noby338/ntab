import { ref } from 'vue';
import type { BookmarkItem } from '../types';
import { getFolderPath } from './bookmarks';

export type CheckStatus =
  | 'ok'
  | 'dead_404'
  | 'blocked_403';

export interface BookmarkCheckResult {
  id: string;
  title: string;
  url: string;
  parentPath: string;
  status: CheckStatus;
  httpCode?: number;
  errorMsg?: string;
  durationMs: number;
}

export interface CheckProgressState {
  isRunning: boolean;
  total: number;
  completed: number;
  currentTitle: string;
  currentUrl: string;
  results: BookmarkCheckResult[];
}

export const checkerState = ref<CheckProgressState>({
  isRunning: false,
  total: 0,
  completed: 0,
  currentTitle: '',
  currentUrl: '',
  results: [],
});

let abortController: AbortController | null = null;

function isCheckableUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith('chrome://') ||
    trimmed.startsWith('chrome-extension://') ||
    trimmed.startsWith('edge://') ||
    trimmed.startsWith('about:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('javascript:')
  ) {
    return false;
  }
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

function isPrivateNetworkUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return true;
    }
  } catch {}
  return false;
}

export function extractAllLeafBookmarks(tree: BookmarkItem[]): BookmarkItem[] {
  const result: BookmarkItem[] = [];

  function walk(nodes: BookmarkItem[]) {
    for (const node of nodes) {
      if (node.children && Array.isArray(node.children)) {
        walk(node.children);
      } else if (node.url && isCheckableUrl(node.url)) {
        result.push(node);
      }
    }
  }

  walk(tree);
  return result;
}

async function probeSingleUrl(
  url: string,
  signal: AbortSignal
): Promise<{ status: CheckStatus; httpCode?: number; errorMsg?: string }> {
  if (isPrivateNetworkUrl(url)) {
    return { status: 'ok', httpCode: 200, errorMsg: 'Local/LAN' };
  }

  const commonHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };

  async function tryFetch(method: 'HEAD' | 'GET', useRange: boolean): Promise<Response | null> {
    const probeController = new AbortController();
    const probeTimeout = setTimeout(() => probeController.abort(), 6000);
    const onParentAbort = () => probeController.abort();
    signal.addEventListener('abort', onParentAbort);

    try {
      return await fetch(url, {
        method,
        signal: probeController.signal,
        cache: 'no-store',
        headers: {
          ...commonHeaders,
          ...(useRange ? { Range: 'bytes=0-1024' } : {}),
        },
      });
    } catch {
      return null;
    } finally {
      clearTimeout(probeTimeout);
      signal.removeEventListener('abort', onParentAbort);
    }
  }

  let res = await tryFetch('HEAD', false);

  if (!res || res.status === 405 || res.status === 400 || res.status >= 500) {
    const getRes = await tryFetch('GET', true);
    if (getRes) {
      res = getRes;
    }
  }

  if (!res) {
    return { status: 'ok', errorMsg: 'Skipped' };
  }

  const code = res.status;

  if (code === 404 || code === 410) {
    return { status: 'dead_404', httpCode: code };
  }

  if (code === 403 || code === 401) {
    return { status: 'blocked_403', httpCode: code };
  }

  return { status: 'ok', httpCode: code };
}

export async function runBookmarkHealthCheck(
  items: BookmarkItem[],
  concurrency = 6
): Promise<BookmarkCheckResult[]> {
  stopBookmarkHealthCheck();
  abortController = new AbortController();
  const signal = abortController.signal;

  checkerState.value = {
    isRunning: true,
    total: items.length,
    completed: 0,
    currentTitle: '',
    currentUrl: '',
    results: [],
  };

  let cursor = 0;
  const results: BookmarkCheckResult[] = [];

  async function worker() {
    while (cursor < items.length && !signal.aborted) {
      const idx = cursor++;
      const item = items[idx];
      if (!item || !item.url) continue;

      checkerState.value.currentTitle = item.title || item.url;
      checkerState.value.currentUrl = item.url;

      const startTime = performance.now();
      const outcome = await probeSingleUrl(item.url, signal);
      const durationMs = Math.round(performance.now() - startTime);

      if (signal.aborted) break;

      const parentPath = item.parentId ? getFolderPath(item.parentId) : '';

      const entry: BookmarkCheckResult = {
        id: item.id,
        title: item.title || item.url,
        url: item.url,
        parentPath,
        status: outcome.status,
        httpCode: outcome.httpCode,
        errorMsg: outcome.errorMsg,
        durationMs,
      };

      results.push(entry);
      checkerState.value.completed++;
      checkerState.value.results = [...results];
    }
  }

  const pool: Promise<void>[] = [];
  const workerCount = Math.min(concurrency, items.length);
  for (let w = 0; w < workerCount; w++) {
    pool.push(worker());
  }

  await Promise.all(pool);
  checkerState.value.isRunning = false;
  return results;
}

export function stopBookmarkHealthCheck() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  checkerState.value.isRunning = false;
}
