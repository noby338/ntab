import { computed } from 'vue';
import type { CustomSearchEngine } from '../types';
import { userSettings, saveSettings } from './storage';

export interface SearchEngineItem {
  id: string;
  name: string;
  url: string;
  icon?: string;
  isCustom?: boolean;
}

export const PRESET_SEARCH_ENGINES: SearchEngineItem[] = [
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=' },
  { id: 'baidu', name: 'Baidu', url: 'https://www.baidu.com/s?wd=' },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=' },
  { id: 'bilibili', name: 'Bilibili', url: 'https://search.bilibili.com/all?keyword=%s' },
  { id: 'github', name: 'GitHub', url: 'https://github.com/search?q=' },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
];

export function buildSearchUrl(engineUrl: string, rawQuery: string): string {
  const encoded = encodeURIComponent(rawQuery.trim());
  if (engineUrl.includes('%s')) {
    return engineUrl.replace(/%s/g, encoded);
  }
  return engineUrl + encoded;
}

export function getAllEngines(): SearchEngineItem[] {
  const custom = (userSettings.value.customSearchEngines || []).map((e) => ({
    ...e,
    isCustom: true,
  }));
  return [...PRESET_SEARCH_ENGINES, ...custom];
}

export function addCustomSearchEngine(name: string, url: string): boolean {
  if (!name.trim() || !url.trim()) return false;
  const list = [...(userSettings.value.customSearchEngines || [])];
  const newEngine: CustomSearchEngine = {
    id: `custom_${Date.now()}`,
    name: name.trim(),
    url: url.trim(),
  };
  list.push(newEngine);
  saveSettings({ customSearchEngines: list });
  return true;
}

export function removeCustomSearchEngine(id: string): void {
  const list = (userSettings.value.customSearchEngines || []).filter((e) => e.id !== id);
  if (userSettings.value.defaultSearchEngine === id) {
    saveSettings({ customSearchEngines: list, defaultSearchEngine: 'google' });
  } else {
    saveSettings({ customSearchEngines: list });
  }
}
