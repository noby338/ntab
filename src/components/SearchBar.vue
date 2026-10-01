<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Search, Globe, ArrowRight, CornerDownLeft, ChevronDown, Check } from '@lucide/vue';
import SearchEngineIcon from './SearchEngineIcon.vue';
import type { BookmarkItem } from '../types';
import { rawBookmarkTree, getFaviconUrl } from '../services/bookmarks';
import { userSettings, saveSettings } from '../services/storage';
import { getAllEngines, buildSearchUrl, type SearchEngineItem } from '../services/searchEngines';
import {
  getActiveShortcut,
  matchesShortcut,
  formatShortcut,
} from '../services/hotkeyService';
import type { ShortcutActionId } from '../types';
import { t } from '../locales';

const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const isFocused = ref(false);
const isEngineMenuOpen = ref(false);
const activeIndex = ref(0);
const faviconErrors = ref<Set<string>>(new Set());

function markFaviconError(id: string) {
  faviconErrors.value.add(id);
}

const allEngines = computed<SearchEngineItem[]>(() => {
  return getAllEngines();
});

const currentEngine = computed<SearchEngineItem>(() => {
  const list = allEngines.value;
  return (
    list.find((e) => e.id === userSettings.value.defaultSearchEngine) ||
    list[0] || {
      id: 'google',
      name: 'Google',
      url: 'https://www.google.com/search?q=',
      icon: '🌐',
    }
  );
});

function selectEngine(id: string) {
  saveSettings({ defaultSearchEngine: id });
  isEngineMenuOpen.value = false;
  inputRef.value?.focus();
}

function selectEngineByIndex(index: number) {
  const list = allEngines.value;
  if (index >= 0 && index < list.length && list[index]) {
    saveSettings({ defaultSearchEngine: list[index].id });
    isEngineMenuOpen.value = false;
  }
}

function cycleEngine() {
  const list = allEngines.value;
  const currentIndex = list.findIndex(
    (e) => e.id === userSettings.value.defaultSearchEngine
  );
  const next = list[(currentIndex + 1) % list.length];
  if (next) {
    saveSettings({ defaultSearchEngine: next.id });
  }
}

interface SearchResultItem {
  id: string;
  title: string;
  url: string;
  path: string;
}

const allBookmarks = computed<SearchResultItem[]>(() => {
  const results: SearchResultItem[] = [];

  function traverse(nodes: BookmarkItem[], path: string[]) {
    for (const node of nodes) {
      if (node.children) {
        traverse(node.children, [...path, node.title]);
      } else if (node.url) {
        results.push({
          id: node.id,
          title: node.title || node.url,
          url: node.url,
          path: path.join(' / '),
        });
      }
    }
  }

  traverse(rawBookmarkTree.value, []);
  return results;
});

const filteredResults = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];

  return allBookmarks.value
    .filter((b) => {
      return (
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        b.path.toLowerCase().includes(q)
      );
    })
    .slice(0, 8);
});

function handleKeyDown(event: KeyboardEvent) {
  // Configured shortcut matching for engines 1..6
  for (let i = 1; i <= Math.min(6, allEngines.value.length); i++) {
    const actionId = `switchEngine${i}` as ShortcutActionId;
    if (matchesShortcut(event, getActiveShortcut(actionId))) {
      event.preventDefault();
      selectEngineByIndex(i - 1);
      return;
    }
  }

  // Cross-platform Option/Alt + 1..9 or Digit1..9 fallback
  if (event.altKey && /^Digit([1-9])$/.test(event.code)) {
    event.preventDefault();
    const idx = parseInt(event.code.replace('Digit', ''), 10) - 1;
    selectEngineByIndex(idx);
    return;
  }

  // Quick single-digit 1..9 switch when input is empty or engine menu is open
  if (
    (isEngineMenuOpen.value || (isFocused.value && !query.value)) &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    /^Digit([1-9])$/.test(event.code)
  ) {
    event.preventDefault();
    const idx = parseInt(event.code.replace('Digit', ''), 10) - 1;
    selectEngineByIndex(idx);
    return;
  }

  if (matchesShortcut(event, getActiveShortcut('cycleSearchEngine')) && isFocused.value && !query.value) {
    event.preventDefault();
    cycleEngine();
    return;
  }

  if (filteredResults.value.length > 0) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex.value = (activeIndex.value + 1) % (filteredResults.value.length + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex.value =
        (activeIndex.value - 1 + filteredResults.value.length + 1) %
        (filteredResults.value.length + 1);
      return;
    }
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    const item = filteredResults.value[activeIndex.value];
    if (filteredResults.value.length > 0 && item) {
      openBookmark(item.url);
    } else {
      executeWebSearch();
    }
  }

  if (event.key === 'Escape') {
    if (isEngineMenuOpen.value) {
      isEngineMenuOpen.value = false;
      return;
    }
    query.value = '';
    inputRef.value?.blur();
  }
}

function handleBlur() {
  setTimeout(() => {
    isFocused.value = false;
  }, 220);
}

function openBookmark(url: string) {
  if (userSettings.value.openInNewTab) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    window.location.href = url;
  }
  query.value = '';
}

function executeWebSearch() {
  const q = query.value.trim();
  if (!q) return;
  const target = buildSearchUrl(currentEngine.value.url, q);
  if (userSettings.value.openInNewTab) {
    window.open(target, '_blank', 'noopener,noreferrer');
  } else {
    window.location.href = target;
  }
  query.value = '';
}

function handleGlobalKey(e: KeyboardEvent) {
  // Focus search
  if (matchesShortcut(e, getActiveShortcut('focusSearch'))) {
    const activeEl = document.activeElement;
    const isEditing =
      activeEl?.tagName === 'INPUT' ||
      activeEl?.tagName === 'TEXTAREA' ||
      activeEl?.getAttribute('contenteditable') === 'true';
    const isModalOpen = !!document.querySelector('.fixed.inset-0.z-50');
    if (!isEditing && !isModalOpen) {
      e.preventDefault();
      inputRef.value?.focus();
      return;
    }
  }

  // Configured shortcut matching for engines 1..6
  for (let i = 1; i <= Math.min(6, allEngines.value.length); i++) {
    const actionId = `switchEngine${i}` as ShortcutActionId;
    if (matchesShortcut(e, getActiveShortcut(actionId))) {
      e.preventDefault();
      selectEngineByIndex(i - 1);
      return;
    }
  }

  // Cross-platform Option/Alt+Digit1..9 fallback
  if (e.altKey && /^Digit([1-9])$/.test(e.code)) {
    e.preventDefault();
    const idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
    selectEngineByIndex(idx);
    return;
  }
}

function handleWindowClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  if (!target?.closest('.engine-menu-container')) {
    isEngineMenuOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKey);
  window.addEventListener('click', handleWindowClick);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKey);
  window.removeEventListener('click', handleWindowClick);
});
</script>

<template>
  <div class="relative w-full max-w-xl mx-auto z-40 select-none">
    <!-- Input Capsule Container -->
    <div
      class="relative flex items-center backdrop-blur-xl border rounded-2xl shadow-lg transition-all duration-200"
      style="background-color: var(--card-bg); border-color: var(--card-border);"
      :class="[
        isFocused
          ? 'ring-4 ring-indigo-500/10'
          : '',
      ]"
    >
      <!-- Search Engine Pill & Dropdown -->
      <div class="relative engine-menu-container">
        <button
          type="button"
          @click.stop="isEngineMenuOpen = !isEngineMenuOpen"
          :title="`${t('search.cycleEngine')} (Alt+1~${Math.min(9, allEngines.length)})`"
          class="ml-2 px-2.5 py-1 text-xs font-semibold rounded-xl text-slate-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2 cursor-pointer flex-shrink-0"
          style="background-color: var(--item-hover);"
        >
          <SearchEngineIcon :engine-id="currentEngine.id" :url="currentEngine.url" size-class="w-4 h-4" />
          <span>{{ currentEngine.name }}</span>
          <ChevronDown class="w-3 h-3 text-slate-400 transition-transform duration-150" :class="{ 'rotate-180': isEngineMenuOpen }" />
        </button>

        <!-- Engine Selector Menu with 12345 Hotkeys -->
        <Transition
          enter-active-class="transition duration-150 ease-out transform"
          enter-from-class="opacity-0 scale-95 -translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in transform"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 -translate-y-1"
        >
          <div
            v-if="isEngineMenuOpen"
            class="absolute top-full left-2 mt-2 w-64 theme-popover backdrop-blur-xl rounded-2xl shadow-2xl p-1.5 z-50 text-xs border border-black/5 dark:border-white/10"
            @click.stop
          >
            <div class="px-2.5 py-1 text-[10px] font-semibold text-slate-400 dark:text-zinc-500 flex items-center justify-between">
              <span>{{ t('search.engineMenuTitle') || '切换搜索引擎 / AI' }}</span>
              <span class="font-mono text-[9px] opacity-75">按 1~9 快捷选择</span>
            </div>

            <div class="max-h-72 overflow-y-auto space-y-0.5 mt-0.5">
              <button
                v-for="(eng, idx) in allEngines"
                :key="eng.id"
                type="button"
                @click="selectEngine(eng.id)"
                class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl theme-popover-item transition-colors text-left cursor-pointer"
                :class="[
                  eng.id === currentEngine.id
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium'
                    : 'text-slate-700 dark:text-zinc-200'
                ]"
              >
                <div class="flex items-center gap-2 truncate">
                  <SearchEngineIcon :engine-id="eng.id" :url="eng.url" size-class="w-4 h-4" />
                  <span class="truncate">{{ eng.name }}</span>
                </div>

                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    v-if="idx < 6"
                    class="px-1.5 py-0.2 rounded font-mono text-[10px] bg-black/5 dark:bg-white/10 text-slate-500 dark:text-zinc-400 border border-black/5 dark:border-white/5"
                  >
                    {{ formatShortcut(getActiveShortcut(('switchEngine' + (idx + 1)) as ShortcutActionId)) }}
                  </span>
                  <span
                    v-else-if="idx < 9"
                    class="px-1.5 py-0.2 rounded font-mono text-[10px] bg-black/5 dark:bg-white/10 text-slate-500 dark:text-zinc-400 border border-black/5 dark:border-white/5"
                  >
                    {{ idx + 1 }}
                  </span>
                  <Check v-if="eng.id === currentEngine.id" class="w-3.5 h-3.5 text-indigo-500" />
                </div>
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Input Field -->
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        :placeholder="t('search.placeholder')"
        @focus="isFocused = true; activeIndex = 0"
        @blur="handleBlur"
        @keydown="handleKeyDown"
        class="w-full bg-transparent px-3 py-3 text-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none"
        style="color: var(--text-main);"
      />

      <!-- Search Icon button -->
      <button
        type="button"
        @click="executeWebSearch"
        class="mr-2.5 p-1.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <Search class="w-4 h-4" />
      </button>
    </div>

    <!-- Dropdown Results -->
    <div
      v-if="isFocused && query.trim()"
      class="absolute top-full left-0 right-0 mt-2 theme-popover backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden py-1.5 z-50 text-xs"
    >
      <!-- Bookmark Results -->
      <template v-if="filteredResults.length > 0">
        <div class="px-3 py-1 font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider text-[10px]">
          {{ t('common.bookmarksCount', { count: filteredResults.length }) }}
        </div>
        <div
          v-for="(item, idx) in filteredResults"
          :key="item.id"
          @mousedown="openBookmark(item.url)"
          @mouseenter="activeIndex = idx"
          class="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors"
          :class="[
            activeIndex === idx
              ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
              : 'hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-700 dark:text-zinc-300',
          ]"
        >
          <div class="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <img
              v-if="!faviconErrors.has(item.id)"
              :src="getFaviconUrl(item.url)"
              class="w-4 h-4 rounded-sm object-contain"
              alt=""
              @error="markFaviconError(item.id)"
            />
            <Globe v-else class="w-3.5 h-3.5 text-slate-400 opacity-60" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">{{ item.title }}</div>
            <div class="text-[11px] text-slate-400 dark:text-zinc-500 truncate font-mono">
              {{ item.path ? item.path + ' · ' : '' }}{{ item.url }}
            </div>
          </div>
          <CornerDownLeft class="w-3.5 h-3.5 text-slate-400 flex-shrink-0 opacity-60" />
        </div>
      </template>

      <!-- Web Search Fallback Option -->
      <div
        @mousedown="executeWebSearch"
        @mouseenter="activeIndex = filteredResults.length"
        class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-t border-slate-100 dark:border-zinc-800/60"
        :class="[
          activeIndex === filteredResults.length
            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium'
            : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800',
        ]"
      >
        <SearchEngineIcon :engine-id="currentEngine.id" :url="currentEngine.url" size-class="w-4 h-4" />
        <span class="flex-1 truncate">
          {{ currentEngine.name }}: “<strong>{{ query }}</strong>”
        </span>
        <ArrowRight class="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
      </div>
    </div>
  </div>
</template>
