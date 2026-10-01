<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import {
  X,
  Palette,
  Layout,
  Sliders,
  RotateCcw,
  Download,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Folder,
  Globe,
  Code2,
  Plus,
  Trash2,
  Bot,
  Keyboard,
  Heart,
  Coffee,
  ExternalLink,
  Activity,
  AlertOctagon,
  ShieldAlert,
  Play,
  Square,
  CheckCircle2,
  Camera,
} from '@lucide/vue';
import {
  checkerState,
  runBookmarkHealthCheck,
  stopBookmarkHealthCheck,
  extractAllLeafBookmarks,
} from '../services/bookmarkChecker';
import ConfirmDeleteModal from './ConfirmDeleteModal.vue';
import {
  userSettings,
  saveSettings,
  columnLayout,
  saveColumnLayout,
  unhideBookmark,
  unhideAllBookmarks,
  unhideFolder,
  unhideAllFolders,
  toggleFolderVisibility,
  setSpecialWidgetVisible,
  buildAdaptiveExportData,
  resolveAdaptiveImportData,
} from '../services/storage';
import {
  getAllEngines,
  addCustomSearchEngine,
  removeCustomSearchEngine,
  PRESET_SEARCH_ENGINES,
} from '../services/searchEngines';
import SearchEngineIcon from './SearchEngineIcon.vue';
import {
  getActiveShortcut,
  formatShortcut,
  recordShortcutFromEvent,
  updateShortcutBinding,
  resetShortcutBinding,
  resetAllShortcuts,
} from '../services/hotkeyService';
import type { ShortcutActionId } from '../types';
import {
  rawBookmarkTree,
  folderMap,
  allBookmarksMap,
  loadTopSites,
  loadRecentlyClosed,
  batchRemoveBookmarks,
  isDemoMode,
  toggleDemoMode,
} from '../services/bookmarks';
import { t, LANGUAGE_OPTIONS, activeLanguage } from '../locales';
import {
  currentGoogleUser,
  isSyncing,
  lastSyncedTime,
  syncStatusMessage,
  loginWithGoogle,
  logoutGoogle,
  backupToGoogleCloud,
  restoreFromGoogleCloud,
  isRealExtension,
} from '../services/googleAuthService';
import AdvancedConfigModal from './AdvancedConfigModal.vue';
import type { ThemeMode } from '../types';

const props = defineProps<{
  isOpen: boolean;
  initialTab?: 'appearance' | 'layout' | 'shortcuts' | 'health' | 'donate' | 'backup';
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const activeTab = ref<'appearance' | 'layout' | 'shortcuts' | 'health' | 'donate' | 'backup'>('appearance');

const healthTab = ref<'dead_404' | 'blocked_403'>('dead_404');
const healthSelectedDeleteIds = ref<Set<string>>(new Set());
const isHealthDeleting = ref(false);
const isHealthConfirmOpen = ref(false);

const allLeafBookmarks = computed(() => extractAllLeafBookmarks(rawBookmarkTree.value));

const healthProgressPercent = computed(() => {
  if (!checkerState.value.total) return 0;
  return Math.min(
    100,
    Math.round((checkerState.value.completed / checkerState.value.total) * 100)
  );
});

const dead404Results = computed(() => {
  return checkerState.value.results.filter((r) => r.status === 'dead_404');
});

const blocked403Results = computed(() => {
  return checkerState.value.results.filter((r) => r.status === 'blocked_403');
});

const displayedHealthResults = computed(() => {
  if (healthTab.value === 'dead_404') return dead404Results.value;
  return blocked403Results.value;
});

watch(
  () => dead404Results.value.length,
  () => {
    const set = new Set(healthSelectedDeleteIds.value);
    for (const item of dead404Results.value) {
      set.add(item.id);
    }
    healthSelectedDeleteIds.value = set;
  }
);

function startHealthCheck() {
  healthSelectedDeleteIds.value.clear();
  runBookmarkHealthCheck(allLeafBookmarks.value);
}

function handleStopHealthCheck() {
  stopBookmarkHealthCheck();
}

function toggleHealthSelect(id: string) {
  const set = new Set(healthSelectedDeleteIds.value);
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  healthSelectedDeleteIds.value = set;
}

function selectAllHealthInTab() {
  const set = new Set(healthSelectedDeleteIds.value);
  for (const item of displayedHealthResults.value) {
    set.add(item.id);
  }
  healthSelectedDeleteIds.value = set;
}

function clearHealthSelect() {
  healthSelectedDeleteIds.value.clear();
}

function selectOnly404Health() {
  healthSelectedDeleteIds.value = new Set(dead404Results.value.map((r) => r.id));
  healthTab.value = 'dead_404';
}

function promptHealthDelete() {
  if (healthSelectedDeleteIds.value.size === 0) return;
  if (userSettings.value.confirmBeforeDelete === false) {
    void handleConfirmedHealthDelete();
    return;
  }
  isHealthConfirmOpen.value = true;
}

async function handleConfirmedHealthDelete() {
  isHealthConfirmOpen.value = false;
  const ids = Array.from(healthSelectedDeleteIds.value);
  if (ids.length === 0) return;

  isHealthDeleting.value = true;
  try {
    await batchRemoveBookmarks(ids);
    checkerState.value.results = checkerState.value.results.filter(
      (r) => !healthSelectedDeleteIds.value.has(r.id)
    );
    healthSelectedDeleteIds.value.clear();
  } finally {
    isHealthDeleting.value = false;
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open && props.initialTab) {
      activeTab.value = props.initialTab;
    }
  }
);

watch(
  () => props.initialTab,
  (tab) => {
    if (tab) {
      activeTab.value = tab;
    }
  }
);

const isZh = computed(() => activeLanguage.value === 'zh-CN' || activeLanguage.value === 'zh-TW');

const selectedPayChannel = ref<'wechat' | 'alipay' | 'paypal' | 'kofi'>(
  isZh.value ? 'wechat' : 'paypal'
);

watch(
  () => isZh.value,
  (zh) => {
    selectedPayChannel.value = zh ? 'wechat' : 'paypal';
  }
);

const PAYPAL_DONATE_URL = 'https://www.paypal.com/ncp/payment/AKBZ3BM5368R8?item_name=Support%20NTab%20Extension&custom=ntab';
const KOFI_DONATE_URL = 'https://ko-fi.com/nobytan?ref=ntab';

const recordingActionId = ref<ShortcutActionId | null>(null);

function startRecordingShortcut(action: ShortcutActionId) {
  recordingActionId.value = action;
  window.addEventListener('keydown', handleRecordKeyDown, true);
}

function handleRecordKeyDown(e: KeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();

  if (e.key === 'Escape') {
    stopRecording();
    return;
  }

  const recorded = recordShortcutFromEvent(e);
  if (recorded && recordingActionId.value) {
    updateShortcutBinding(recordingActionId.value, recorded);
    stopRecording();
  }
}

function stopRecording() {
  recordingActionId.value = null;
  window.removeEventListener('keydown', handleRecordKeyDown, true);
}

onUnmounted(() => {
  stopRecording();
});

function isCustomizedShortcut(action: ShortcutActionId): boolean {
  return Boolean(userSettings.value.shortcuts?.[action]);
}

const SEARCH_SHORTCUT_ACTIONS = computed(() => [
  { id: 'focusSearch' as ShortcutActionId, title: t('shortcuts.actFocusSearch'), desc: t('shortcuts.actFocusSearchDesc') },
  { id: 'cycleSearchEngine' as ShortcutActionId, title: t('shortcuts.actCycleSearchEngine'), desc: t('shortcuts.actCycleSearchEngineDesc') },
  { id: 'switchEngine1' as ShortcutActionId, title: t('shortcuts.actSwitchEngine1'), desc: t('shortcuts.actSwitchEngine1Desc') },
  { id: 'switchEngine2' as ShortcutActionId, title: t('shortcuts.actSwitchEngine2'), desc: t('shortcuts.actSwitchEngine2Desc') },
  { id: 'switchEngine3' as ShortcutActionId, title: t('shortcuts.actSwitchEngine3'), desc: t('shortcuts.actSwitchEngine3Desc') },
  { id: 'switchEngine4' as ShortcutActionId, title: t('shortcuts.actSwitchEngine4'), desc: t('shortcuts.actSwitchEngine4Desc') },
  { id: 'switchEngine5' as ShortcutActionId, title: t('shortcuts.actSwitchEngine5'), desc: t('shortcuts.actSwitchEngine5Desc') },
  { id: 'switchEngine6' as ShortcutActionId, title: t('shortcuts.actSwitchEngine6'), desc: t('shortcuts.actSwitchEngine6Desc') },
]);

const MANAGEMENT_SHORTCUT_ACTIONS = computed(() => [
  { id: 'newFolder' as ShortcutActionId, title: t('shortcuts.actNewFolder'), desc: t('shortcuts.actNewFolderDesc') },
  { id: 'toggleBatch' as ShortcutActionId, title: t('shortcuts.actToggleBatch'), desc: t('shortcuts.actToggleBatchDesc') },
  { id: 'healthCheck' as ShortcutActionId, title: t('shortcuts.actHealthCheck'), desc: t('shortcuts.actHealthCheckDesc') },
  { id: 'openSettings' as ShortcutActionId, title: t('shortcuts.actOpenSettings'), desc: t('shortcuts.actOpenSettingsDesc') },
]);

const newEngineName = ref('');
const newEngineUrl = ref('');

function handleAddCustomEngine() {
  if (!newEngineName.value.trim() || !newEngineUrl.value.trim()) return;
  addCustomSearchEngine(newEngineName.value, newEngineUrl.value);
  newEngineName.value = '';
  newEngineUrl.value = '';
}

function getItemTitle(id: string): string {
  const item = allBookmarksMap.value.get(id);
  if (item && item.title?.trim()) {
    return item.title.trim();
  }
  const folder = folderMap.value.get(id);
  if (folder && folder.title?.trim()) {
    return folder.title.trim();
  }
  return `ID: ${id}`;
}

const hiddenFolderList = computed(() => {
  const folderIdSet = new Set<string>(userSettings.value.hiddenFolderIds || []);
  for (const id of userSettings.value.hiddenBookmarkIds || []) {
    if (folderMap.value.has(id)) {
      folderIdSet.add(id);
    }
  }
  return Array.from(folderIdSet);
});

const hiddenBookmarkList = computed(() => {
  return (userSettings.value.hiddenBookmarkIds || []).filter((id) => !folderMap.value.has(id));
});

const THEMES = computed<{ id: ThemeMode; name: string; desc: string; preview: string }[]>(() => [
  { id: 'system', name: 'System', desc: t('settings.themeSystemDesc'), preview: 'bg-gradient-to-r from-slate-100 to-zinc-900' },
  { id: 'light', name: 'Light', desc: t('settings.themeLightDesc'), preview: 'bg-white border border-slate-200' },
  { id: 'cream', name: 'Cream', desc: t('settings.themeCreamDesc'), preview: 'bg-[#fbf7ee] border border-[#e0d7c4]' },
  { id: 'sepia', name: 'Sepia', desc: t('settings.themeSepiaDesc'), preview: 'bg-[#2b221d] border border-[#a8846d]' },
  { id: 'dark', name: 'Dark', desc: t('settings.themeDarkDesc'), preview: 'bg-zinc-950 border border-zinc-800' },
  { id: 'nord', name: 'Nord', desc: t('settings.themeNordDesc'), preview: 'bg-[#2e3440]' },
  { id: 'catppuccin', name: 'Catppuccin', desc: t('settings.themeCatppuccinDesc'), preview: 'bg-[#1e1e2e]' },
  { id: 'tokyo-night', name: 'Tokyo Night', desc: t('settings.themeTokyoNightDesc'), preview: 'bg-[#1a1b26]' },
]);

function selectTheme(theme: ThemeMode) {
  saveSettings({ theme });
}

function handleResetLayout() {
  if (confirm(t('settings.resetLayoutDesc') + '?')) {
    const cols: string[][] = [];
    const root0 = rawBookmarkTree.value[0];
    if (root0) cols.push([root0.id]);
    const root1 = rawBookmarkTree.value[1];
    if (root1) cols.push([root1.id]);
    cols.push(['top_sites', 'recently_closed']);
    saveColumnLayout({ columns: cols });
    window.location.reload();
  }
}

const exportJson = ref('');
const importJson = ref('');
const importSuccess = ref(false);
const isCopied = ref(false);
const isAdvancedModalOpen = ref(false);

function handleExport() {
  const data = buildAdaptiveExportData();
  exportJson.value = JSON.stringify(data, null, 2);
}

function handleCopyConfig() {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(exportJson.value);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 1500);
  }
}

function handleImport() {
  try {
    const parsed = JSON.parse(importJson.value);
    const { settings, columns } = resolveAdaptiveImportData(parsed);
    saveSettings(settings);
    saveColumnLayout({ columns });
    importSuccess.value = true;
    setTimeout(() => {
      importSuccess.value = false;
      window.location.reload();
    }, 800);
  } catch {
    alert(t('settings.importError'));
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-2xl h-[650px] max-h-[90vh] flex flex-col theme-popover rounded-3xl shadow-2xl overflow-hidden"
        style="font-size: 14px;"
      >
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/5"
        >
          <div class="flex items-center gap-3">
            <span class="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">{{ t('settings.title') }}</span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono">v1.0.0</span>

            <!-- Top Header Account Badge -->
            <div
              v-if="currentGoogleUser"
              @click="activeTab = 'backup'"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/60 dark:border-white/5 cursor-pointer hover:border-indigo-400 transition-colors"
              :title="`${currentGoogleUser.email} (${t('auth.manageSync') || '点击管理同步'})`"
            >
              <img
                v-if="currentGoogleUser.picture"
                :src="currentGoogleUser.picture"
                class="w-4 h-4 rounded-full object-cover"
                alt=""
              />
              <span class="text-xs font-medium text-slate-700 dark:text-zinc-300 max-w-[100px] truncate">
                {{ currentGoogleUser.name }}
              </span>
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </div>

            <button
              v-else
              type="button"
              @click="loginWithGoogle()"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-medium hover:border-indigo-400 transition-colors cursor-pointer shadow-2xs"
            >
              <SearchEngineIcon engine-id="google" size-class="w-3.5 h-3.5" />
              <span>{{ t('auth.signInWithGoogle') || 'Google 登录' }}</span>
            </button>
          </div>
          <button
            type="button"
            @click="emit('close')"
            class="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="flex items-center px-6 gap-1 border-b border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2 text-xs font-medium overflow-x-auto whitespace-nowrap">
          <button
            type="button"
            @click="activeTab = 'appearance'"
            class="flex items-center gap-1.5 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            :class="[
              activeTab === 'appearance'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200',
            ]"
          >
            <Palette class="w-4 h-4" />
            <span>{{ t('settings.tabAppearance') }}</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'layout'"
            class="flex items-center gap-1.5 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            :class="[
              activeTab === 'layout'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200',
            ]"
          >
            <Layout class="w-4 h-4" />
            <span>{{ t('settings.tabLayout') }}</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'shortcuts'"
            class="flex items-center gap-1.5 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            :class="[
              activeTab === 'shortcuts'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200',
            ]"
          >
            <Keyboard class="w-4 h-4" />
            <span>{{ t('settings.tabShortcuts') || '快捷键' }}</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'health'"
            class="flex items-center gap-1.5 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            :class="[
              activeTab === 'health'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200',
            ]"
          >
            <Activity class="w-4 h-4" />
            <span>{{ t('settings.tabHealth') || t('healthCheck.title') || '失效检测' }}</span>
            <span
              v-if="dead404Results.length > 0"
              class="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-red-500 text-white"
            >
              {{ dead404Results.length }}
            </span>
          </button>

          <button
            type="button"
            @click="activeTab = 'donate'"
            class="flex items-center gap-1.5 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            :class="[
              activeTab === 'donate'
                ? 'border-pink-500 text-pink-600 dark:border-pink-400 dark:text-pink-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200',
            ]"
          >
            <Heart class="w-4 h-4 fill-pink-500/20" />
            <span>{{ t('settings.tabDonate') || '赞赏支持' }}</span>
          </button>

          <button
            type="button"
            @click="activeTab = 'backup'; handleExport()"
            class="flex items-center gap-1.5 py-3 px-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            :class="[
              activeTab === 'backup'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200',
            ]"
          >
            <Sliders class="w-4 h-4" />
            <span>{{ t('settings.tabBackup') }}</span>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          <div v-if="activeTab === 'appearance'" class="space-y-4">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div>
                  <span class="font-medium text-slate-800 dark:text-zinc-200">{{ t('settings.language') }}</span>
                  <div class="text-[11px] text-slate-400">{{ t('settings.languageDesc') }}</div>
                </div>
                <select
                  :value="userSettings.language"
                  @change="saveSettings({ language: ($event.target as HTMLSelectElement).value as any })"
                  class="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
                >
                  <option v-for="opt in LANGUAGE_OPTIONS" :key="opt.code" :value="opt.code">
                    {{ opt.code === 'auto' ? t('settings.langAuto') : opt.nativeName }}
                  </option>
                </select>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
              <div>
                <span class="font-medium text-slate-900 dark:text-zinc-100">{{ t('settings.theme') }}</span>
                <div class="text-[11px] text-slate-400">{{ t('settings.themeDesc') }}</div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div
                  v-for="th in THEMES"
                  :key="th.id"
                  @click="selectTheme(th.id)"
                  class="flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all duration-150"
                  :class="[
                    userSettings.theme === th.id
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700',
                  ]"
                >
                  <div :class="th.preview" class="w-8 h-8 rounded-xl shadow-xs flex-shrink-0"></div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-xs text-slate-900 dark:text-zinc-100 truncate">{{ th.name }}</div>
                    <div class="text-[11px] text-slate-400 truncate">{{ th.desc }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-700 dark:text-zinc-300">{{ t('settings.fontSize') }}</span>
                  <div class="text-[11px] text-slate-400">{{ t('settings.fontSizeDesc') }}</div>
                </div>
                <span class="text-xs text-slate-500 font-mono">{{ userSettings.fontSize }}px</span>
              </div>
              <input
                type="range"
                min="8"
                max="32"
                step="1"
                :value="userSettings.fontSize"
                @input="saveSettings({ fontSize: Number(($event.target as HTMLInputElement).value) })"
                class="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-700 dark:text-zinc-300">{{ t('settings.rowHeight') }}</span>
                  <div class="text-[11px] text-slate-400">{{ t('settings.rowHeightDesc') }}</div>
                </div>
                <span class="text-xs text-slate-500 font-mono">{{ userSettings.rowHeight }}px</span>
              </div>
              <input
                type="range"
                min="12"
                max="64"
                step="1"
                :value="userSettings.rowHeight"
                @input="saveSettings({ rowHeight: Number(($event.target as HTMLInputElement).value) })"
                class="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-700 dark:text-zinc-300">{{ t('settings.hoverSpeed') }}</span>
                  <div class="text-[11px] text-slate-400">{{ t('settings.hoverSpeedDesc') }}</div>
                </div>
                <span class="text-xs text-slate-500 font-mono">{{ userSettings.hoverDuration }}ms</span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="saveSettings({ hoverDuration: 0 })"
                  class="px-2.5 py-1 text-xs rounded-lg border font-mono transition-colors cursor-pointer"
                  :class="userSettings.hoverDuration === 0 ? 'bg-indigo-600 text-white border-indigo-600 font-semibold' : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'"
                >
                  {{ t('settings.speedInstant') }}
                </button>
                <button
                  type="button"
                  @click="saveSettings({ hoverDuration: 75 })"
                  class="px-2.5 py-1 text-xs rounded-lg border font-mono transition-colors cursor-pointer"
                  :class="userSettings.hoverDuration === 75 ? 'bg-indigo-600 text-white border-indigo-600 font-semibold' : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'"
                >
                  {{ t('settings.speedAgile') }}
                </button>
                <button
                  type="button"
                  @click="saveSettings({ hoverDuration: 150 })"
                  class="px-2.5 py-1 text-xs rounded-lg border font-mono transition-colors cursor-pointer"
                  :class="userSettings.hoverDuration === 150 ? 'bg-indigo-600 text-white border-indigo-600 font-semibold' : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'"
                >
                  {{ t('settings.speedSmooth') }}
                </button>
                <button
                  type="button"
                  @click="saveSettings({ hoverDuration: 300 })"
                  class="px-2.5 py-1 text-xs rounded-lg border font-mono transition-colors cursor-pointer"
                  :class="userSettings.hoverDuration === 300 ? 'bg-indigo-600 text-white border-indigo-600 font-semibold' : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'"
                >
                  {{ t('settings.speedGentle') }}
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="5"
                :value="userSettings.hoverDuration"
                @input="saveSettings({ hoverDuration: Number(($event.target as HTMLInputElement).value) })"
                class="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          <div v-if="activeTab === 'layout'" class="space-y-4">
            <div class="space-y-3">
              <label class="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                <span class="text-slate-700 dark:text-zinc-300">{{ t('settings.openInNewTab') }}</span>
                <input
                  type="checkbox"
                  :checked="userSettings.openInNewTab"
                  @change="saveSettings({ openInNewTab: ($event.target as HTMLInputElement).checked })"
                  class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>

              <label class="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                <span class="text-slate-700 dark:text-zinc-300">{{ t('settings.showClock') }}</span>
                <input
                  type="checkbox"
                  :checked="userSettings.showClock"
                  @change="saveSettings({ showClock: ($event.target as HTMLInputElement).checked })"
                  class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>

              <label class="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                <span class="text-slate-700 dark:text-zinc-300">{{ t('settings.showSearch') }}</span>
                <input
                  type="checkbox"
                  :checked="userSettings.showSearch"
                  @change="saveSettings({ showSearch: ($event.target as HTMLInputElement).checked })"
                  class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>

              <label class="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                <div>
                  <span class="text-slate-700 dark:text-zinc-300 font-medium">{{ t('settings.compactHeader') }}</span>
                  <div class="text-[11px] text-slate-400">{{ t('settings.compactHeaderDesc') }}</div>
                </div>
                <input
                  type="checkbox"
                  :checked="userSettings.compactHeader"
                  @change="saveSettings({ compactHeader: ($event.target as HTMLInputElement).checked })"
                  class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>

              <label class="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                <div>
                  <span class="text-slate-700 dark:text-zinc-300">{{ t('settings.hideBookmarkIcons') }}</span>
                  <div class="text-[11px] text-slate-400">{{ t('settings.hideBookmarkIconsDesc') }}</div>
                </div>
                <input
                  type="checkbox"
                  :checked="userSettings.hideBookmarkIcons"
                  @change="saveSettings({ hideBookmarkIcons: ($event.target as HTMLInputElement).checked })"
                  class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>

              <label class="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                <div>
                  <span class="text-slate-700 dark:text-zinc-300 font-medium">{{ t('settings.confirmBeforeDelete') || '删除二次确认' }}</span>
                  <div class="text-[11px] text-slate-400">{{ t('settings.confirmBeforeDeleteDesc') || '关闭后，删除书签或文件夹将直接移入最近删除，不再弹出二次确认' }}</div>
                </div>
                <input
                  type="checkbox"
                  :checked="userSettings.confirmBeforeDelete !== false"
                  @change="saveSettings({ confirmBeforeDelete: ($event.target as HTMLInputElement).checked })"
                  class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>
            </div>

            <!-- Pure Fullscreen Guide: Chrome Native Footer -->
            <div class="p-3.5 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 space-y-2.5">
              <div class="flex items-center gap-2">
                <span class="text-base">✨</span>
                <span class="font-semibold text-xs text-slate-800 dark:text-zinc-100">
                  {{ t('settings.chromeFooterGuideTitle') || '纯净全屏：如何关闭 Chrome 原生底部页脚？' }}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                {{ t('settings.chromeFooterGuideDesc') || 'Chrome 默认会在新标签页底部保留扩展归属与自定义页脚栏。因 Chrome 安全权限隔离，任何第三方扩展均无权直接通过代码静默关闭它，但你可以通过 Chrome 原生官方开关一键彻底隐藏：' }}
              </div>
              <div class="bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-slate-200/60 dark:border-zinc-800 text-[11px] space-y-1.5 text-slate-700 dark:text-zinc-300">
                <div class="flex items-center gap-2">
                  <span class="w-4 h-4 rounded-full bg-indigo-500 text-white font-mono font-bold text-[9px] flex items-center justify-center flex-shrink-0">1</span>
                  <span>{{ t('settings.chromeFooterStep1') || '点击屏幕右下角已有的「自定义 Chrome」 (铅笔图标)' }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="w-4 h-4 rounded-full bg-indigo-500 text-white font-mono font-bold text-[9px] flex items-center justify-center flex-shrink-0">2</span>
                  <span>{{ t('settings.chromeFooterStep2') || '在浏览器右侧滑出的面板中，找到【页脚】栏目' }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="w-4 h-4 rounded-full bg-indigo-500 text-white font-mono font-bold text-[9px] flex items-center justify-center flex-shrink-0">3</span>
                  <span>{{ t('settings.chromeFooterStep3') || '关闭「在“新标签页”页面上显示页脚」开关，即可享受 100% 极简沉浸视觉！' }}</span>
                </div>
              </div>
            </div>

            <!-- Search Engine Configuration Section -->
            <div v-if="userSettings.showSearch" class="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
              <div>
                <span class="font-medium text-slate-700 dark:text-zinc-300">{{ t('search.engineSettingTitle') }}</span>
                <div class="text-[11px] text-slate-400">{{ t('search.engineSettingDesc') }}</div>
              </div>

              <!-- Default Engine Selection Dropdown -->
              <div class="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40">
                <span class="text-xs text-slate-700 dark:text-zinc-300 font-medium">{{ t('settings.defaultSearchEngine') }}</span>
                <select
                  :value="userSettings.defaultSearchEngine"
                  @change="saveSettings({ defaultSearchEngine: ($event.target as HTMLSelectElement).value })"
                  class="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium max-w-[200px]"
                >
                  <option v-for="eng in getAllEngines()" :key="eng.id" :value="eng.id">
                    {{ eng.name }}
                  </option>
                </select>
              </div>

              <!-- Custom Engines List -->
              <div v-if="userSettings.customSearchEngines && userSettings.customSearchEngines.length > 0" class="space-y-1.5">
                <div class="text-[11px] font-semibold text-slate-400 px-1">{{ t('search.customEnginesList') }}</div>
                <div
                  v-for="custom in userSettings.customSearchEngines"
                  :key="custom.id"
                  class="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-xs"
                >
                  <div class="flex items-center gap-2 truncate mr-2">
                    <SearchEngineIcon :url="custom.url" size-class="w-4 h-4" />
                    <span class="font-medium text-slate-800 dark:text-zinc-200 truncate">{{ custom.name }}</span>
                    <span class="text-[10px] text-slate-400 font-mono truncate max-w-[160px]">{{ custom.url }}</span>
                  </div>
                  <button
                    type="button"
                    @click="removeCustomSearchEngine(custom.id)"
                    class="p-1 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                    :title="t('common.delete')"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Add New Custom Engine Card -->
              <div class="p-3 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-950/20 space-y-2.5">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Plus class="w-3.5 h-3.5 text-indigo-500" />
                    <span>{{ t('search.addCustomEngine') }}</span>
                  </span>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <input
                    v-model="newEngineName"
                    type="text"
                    :placeholder="t('search.engineNamePlaceholder') || '引擎名称 (如: Perplexity)'"
                    class="col-span-1 px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    v-model="newEngineUrl"
                    type="text"
                    :placeholder="t('search.engineUrlPlaceholder') || '搜索 URL (使用 %s 代指关键词)'"
                    class="col-span-2 px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div class="flex items-center justify-between pt-1">
                  <span class="text-[10px] text-slate-400 font-mono">{{ t('search.engineExample') || '例如: https://www.perplexity.ai/search?q=%s' }}</span>
                  <button
                    type="button"
                    @click="handleAddCustomEngine"
                    :disabled="!newEngineName.trim() || !newEngineUrl.trim()"
                    class="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>{{ t('common.create') }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
              <div>
                <span class="font-medium text-slate-700 dark:text-zinc-300">{{ t('settings.columnAndCards') }}</span>
                <div class="text-[11px] text-slate-400">{{ t('settings.columnAndCardsDesc') }}</div>
              </div>

              <div class="space-y-2">
                <div class="p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-2 bg-slate-50/50 dark:bg-zinc-950/40">
                  <label class="flex items-center justify-between cursor-pointer">
                    <span class="font-medium text-xs text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                      <span>⚡</span> {{ t('card.specialApps') }} (chrome://)
                    </span>
                    <input
                      type="checkbox"
                      :checked="userSettings.showApps"
                      @change="setSpecialWidgetVisible('apps', ($event.target as HTMLInputElement).checked)"
                      class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                </div>

                <div class="p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-2 bg-slate-50/50 dark:bg-zinc-950/40">
                  <label class="flex items-center justify-between cursor-pointer">
                    <span class="font-medium text-xs text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                      <span>📈</span> {{ t('settings.topSites') }}
                    </span>
                    <input
                      type="checkbox"
                      :checked="userSettings.showTopSites"
                      @change="setSpecialWidgetVisible('top_sites', ($event.target as HTMLInputElement).checked); if (($event.target as HTMLInputElement).checked) loadTopSites(userSettings.topSitesCount)"
                      class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                  <div v-if="userSettings.showTopSites" class="flex items-center justify-between pl-6 text-xs text-slate-500">
                    <span>{{ t('settings.topSitesCount', { count: userSettings.topSitesCount }) }}</span>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      step="1"
                      :value="userSettings.topSitesCount"
                      @input="saveSettings({ topSitesCount: Number(($event.target as HTMLInputElement).value) }); loadTopSites(userSettings.topSitesCount)"
                      class="w-36 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>

                <div class="p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-2 bg-slate-50/50 dark:bg-zinc-950/40">
                  <label class="flex items-center justify-between cursor-pointer">
                    <span class="font-medium text-xs text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                      <span>🕒</span> {{ t('settings.recentlyClosed') }}
                    </span>
                    <input
                      type="checkbox"
                      :checked="userSettings.showRecentlyClosed"
                      @change="setSpecialWidgetVisible('recently_closed', ($event.target as HTMLInputElement).checked); if (($event.target as HTMLInputElement).checked) loadRecentlyClosed(userSettings.recentlyClosedCount)"
                      class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                  <div v-if="userSettings.showRecentlyClosed" class="flex items-center justify-between pl-6 text-xs text-slate-500">
                    <span>{{ t('settings.recentlyClosedCount', { count: userSettings.recentlyClosedCount }) }}</span>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      step="1"
                      :value="userSettings.recentlyClosedCount"
                      @input="saveSettings({ recentlyClosedCount: Number(($event.target as HTMLInputElement).value) }); loadRecentlyClosed(userSettings.recentlyClosedCount)"
                      class="w-36 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>

                <div class="p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-2 bg-slate-50/50 dark:bg-zinc-950/40">
                  <label class="flex items-center justify-between cursor-pointer">
                    <span class="font-medium text-xs text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                      <span>🗑️</span> {{ t('settings.recentlyDeleted') || '最近删除 (7天)' }}
                    </span>
                    <input
                      type="checkbox"
                      :checked="userSettings.showRecentlyDeleted !== false"
                      @change="setSpecialWidgetVisible('recently_deleted', ($event.target as HTMLInputElement).checked)"
                      class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                </div>

                <div
                  v-for="rootFolder in rawBookmarkTree"
                  :key="rootFolder.id"
                  class="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40 cursor-pointer"
                  @click="toggleFolderVisibility(rootFolder.id)"
                >
                  <span class="font-medium text-xs text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                    <span>📁</span> {{ rootFolder.title || t('settings.rootFolders') }}
                  </span>
                  <input
                    type="checkbox"
                    :checked="!userSettings.hiddenFolderIds?.includes(rootFolder.id)"
                    @click.stop="toggleFolderVisibility(rootFolder.id)"
                    class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 pointer-events-auto"
                  />
                </div>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-700 dark:text-zinc-300">{{ t('settings.columnWidth') }}</span>
                  <div class="text-[11px] text-slate-400">{{ t('settings.columnWidthDesc') }}</div>
                </div>
                <span class="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold">{{ userSettings.columnWidth }}%</span>
              </div>

              <!-- Quick Presets: Ordered from small percentage (more columns) to large percentage (fewer columns) -->
              <div class="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5 text-xs">
                <button
                  v-for="preset in [
                    { label: '10%', cols: 10, val: 10 },
                    { label: '12.5%', cols: 8, val: 12.5 },
                    { label: '14%', cols: 7, val: 14 },
                    { label: '16.6%', cols: 6, val: 16.6 },
                    { label: '20%', cols: 5, val: 20 },
                    { label: '25%', cols: 4, val: 25 },
                    { label: '33.3%', cols: 3, val: 33.3 },
                    { label: '50%', cols: 2, val: 50 },
                    { label: '100%', cols: 1, val: 100 },
                  ]"
                  :key="preset.val"
                  type="button"
                  @click="saveSettings({ columnWidth: preset.val })"
                  class="py-1 px-1 rounded-xl border text-center transition-colors cursor-pointer flex flex-col items-center justify-center"
                  :class="Math.abs(userSettings.columnWidth - preset.val) < 0.8
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                    : 'border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5'"
                >
                  <span class="font-mono text-xs">{{ preset.label }}</span>
                  <span class="text-[9px] opacity-70 leading-none mt-0.5 whitespace-nowrap">
                    {{ preset.cols === 1 ? t('settings.columnCountSingle') : t('settings.columnCount', { count: preset.cols }) }}
                  </span>
                </button>
              </div>

              <input
                type="range"
                min="8"
                max="100"
                step="0.5"
                :value="userSettings.columnWidth"
                @input="saveSettings({ columnWidth: Number(($event.target as HTMLInputElement).value) })"
                class="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-700 dark:text-zinc-300">{{ t('settings.columnGap') }}</span>
                  <div class="text-[11px] text-slate-400">{{ t('settings.columnGapDesc') }}</div>
                </div>
                <span class="text-xs text-slate-500 font-mono">{{ userSettings.columnGap }}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="2"
                :value="userSettings.columnGap"
                @input="saveSettings({ columnGap: Number(($event.target as HTMLInputElement).value) })"
                class="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-700 dark:text-zinc-300">{{ t('settings.columnAlign') }}</span>
                  <div class="text-[11px] text-slate-400">{{ t('settings.columnAlignDesc') }}</div>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  @click="saveSettings({ columnAlign: 'left' })"
                  class="py-2 px-3 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  :class="userSettings.columnAlign === 'left' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'"
                >
                  <AlignLeft class="w-4 h-4" />
                  <span>{{ t('settings.alignLeft') }}</span>
                </button>
                <button
                  type="button"
                  @click="saveSettings({ columnAlign: 'center' })"
                  class="py-2 px-3 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  :class="userSettings.columnAlign === 'center' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'"
                >
                  <AlignCenter class="w-4 h-4" />
                  <span>{{ t('settings.alignCenter') }}</span>
                </button>
                <button
                  type="button"
                  @click="saveSettings({ columnAlign: 'right' })"
                  class="py-2 px-3 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  :class="userSettings.columnAlign === 'right' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'"
                >
                  <AlignRight class="w-4 h-4" />
                  <span>{{ t('settings.alignRight') }}</span>
                </button>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-700 dark:text-zinc-300">{{ t('settings.hiddenBookmarks') }}</span>
                  <div class="text-[11px] text-slate-400">{{ t('settings.hiddenBookmarksDesc') }}</div>
                </div>
                <button
                  v-if="hiddenBookmarkList.length > 0"
                  type="button"
                  @click="unhideAllBookmarks"
                  class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {{ t('common.restoreAll') }}
                </button>
              </div>

              <div
                v-if="hiddenBookmarkList.length > 0"
                class="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 rounded-xl"
              >
                <div
                  v-for="id in hiddenBookmarkList"
                  :key="id"
                  class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-xs"
                >
                  <div class="flex items-center gap-2 flex-1 min-w-0 mr-2">
                    <Globe class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span class="truncate font-medium text-slate-700 dark:text-zinc-300">{{ getItemTitle(id) }}</span>
                  </div>
                  <button
                    type="button"
                    @click="unhideBookmark(id)"
                    class="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                  >
                    {{ t('common.restore') }}
                  </button>
                </div>
              </div>
              <div v-else class="text-xs text-slate-400 dark:text-zinc-500 italic py-1">
                {{ t('settings.noHiddenBookmarks') }}
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-700 dark:text-zinc-300">{{ t('settings.hiddenFolders') }}</span>
                  <div class="text-[11px] text-slate-400">{{ t('settings.hiddenFoldersDesc') }}</div>
                </div>
                <button
                  v-if="hiddenFolderList.length > 0"
                  type="button"
                  @click="unhideAllFolders"
                  class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {{ t('common.restoreAll') }}
                </button>
              </div>

              <div
                v-if="hiddenFolderList.length > 0"
                class="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 rounded-xl"
              >
                <div
                  v-for="id in hiddenFolderList"
                  :key="id"
                  class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-xs"
                >
                  <div class="flex items-center gap-2 flex-1 min-w-0 mr-2">
                    <Folder class="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span class="truncate font-medium text-slate-700 dark:text-zinc-300">{{ getItemTitle(id) }}</span>
                    <span v-if="folderMap.get(id)?.children" class="text-[10px] text-slate-400 font-mono flex-shrink-0">
                      ({{ folderMap.get(id)?.children?.length }})
                    </span>
                  </div>
                  <button
                    type="button"
                    @click="unhideFolder(id)"
                    class="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                  >
                    {{ t('common.restore') }}
                  </button>
                </div>
              </div>
              <div v-else class="text-xs text-slate-400 dark:text-zinc-500 italic py-1">
                {{ t('settings.noHiddenFolders') }}
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <div class="font-medium text-slate-700 dark:text-zinc-300">{{ t('settings.resetLayout') }}</div>
                <div class="text-xs text-slate-400">{{ t('settings.resetLayoutDesc') }}</div>
              </div>
              <button
                type="button"
                @click="handleResetLayout"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                <RotateCcw class="w-3.5 h-3.5" />
                <span>{{ t('settings.resetButton') }}</span>
              </button>
            </div>
          </div>

          <!-- Shortcuts Tab -->
          <div v-if="activeTab === 'shortcuts'" class="space-y-6">
            <div class="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs">
              <div class="flex items-center gap-2.5 min-w-0 mr-3">
                <Keyboard class="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <div class="min-w-0">
                  <div class="font-bold text-slate-800 dark:text-zinc-100 truncate">{{ t('shortcuts.title') || '快捷键偏好设置' }}</div>
                  <div class="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{{ t('shortcuts.desc') || '点击按键药丸即可录制自定义快捷键，支持全局瞬时响应' }}</div>
                </div>
              </div>
              <button
                type="button"
                @click="resetAllShortcuts"
                class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-xs font-medium cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                {{ t('shortcuts.resetAll') || '恢复全部默认' }}
              </button>
            </div>

            <!-- Group 1: Search & Engine Hotkeys -->
            <div class="space-y-3">
              <div class="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                <span>🔍</span>
                <span>{{ t('shortcuts.groupSearch') || '搜索与引擎快捷切换' }}</span>
              </div>
              <div class="space-y-1.5">
                <div
                  v-for="act in SEARCH_SHORTCUT_ACTIONS"
                  :key="act.id"
                  class="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-xs"
                >
                  <div class="truncate mr-3">
                    <div class="font-medium text-slate-800 dark:text-zinc-200 truncate">{{ act.title }}</div>
                    <div class="text-[11px] text-slate-400 truncate">{{ act.desc }}</div>
                  </div>

                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      @click="startRecordingShortcut(act.id)"
                      class="px-2.5 py-1 rounded-lg border font-mono text-xs transition-all cursor-pointer select-none"
                      :class="[
                        recordingActionId === act.id
                          ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-500/30 animate-pulse'
                          : isCustomizedShortcut(act.id)
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-500/40 font-semibold'
                          : 'bg-slate-50 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-indigo-400'
                      ]"
                    >
                      {{ recordingActionId === act.id ? (t('shortcuts.recording') || '按下新快捷键...') : formatShortcut(getActiveShortcut(act.id)) }}
                    </button>
                    <button
                      v-if="isCustomizedShortcut(act.id)"
                      type="button"
                      @click="resetShortcutBinding(act.id)"
                      class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      :title="t('shortcuts.resetSingle') || '恢复此项默认'"
                    >
                      <RotateCcw class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Group 2: Management & Action Hotkeys -->
            <div class="space-y-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <div class="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                <span>⚡</span>
                <span>{{ t('shortcuts.groupActions') || '常用操作与弹窗呼出' }}</span>
              </div>
              <div class="space-y-1.5">
                <div
                  v-for="act in MANAGEMENT_SHORTCUT_ACTIONS"
                  :key="act.id"
                  class="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-xs"
                >
                  <div class="truncate mr-3">
                    <div class="font-medium text-slate-800 dark:text-zinc-200 truncate">{{ act.title }}</div>
                    <div class="text-[11px] text-slate-400 truncate">{{ act.desc }}</div>
                  </div>

                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      @click="startRecordingShortcut(act.id)"
                      class="px-2.5 py-1 rounded-lg border font-mono text-xs transition-all cursor-pointer select-none"
                      :class="[
                        recordingActionId === act.id
                          ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-500/30 animate-pulse'
                          : isCustomizedShortcut(act.id)
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-500/40 font-semibold'
                          : 'bg-slate-50 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-indigo-400'
                      ]"
                    >
                      {{ recordingActionId === act.id ? (t('shortcuts.recording') || '按下新快捷键...') : formatShortcut(getActiveShortcut(act.id)) }}
                    </button>
                    <button
                      v-if="isCustomizedShortcut(act.id)"
                      type="button"
                      @click="resetShortcutBinding(act.id)"
                      class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      :title="t('shortcuts.resetSingle') || '恢复此项默认'"
                    >
                      <RotateCcw class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Health Check Tab (Integrated directly into Settings) -->
          <div v-if="activeTab === 'health'" class="space-y-4">
            <!-- Header Status Card -->
            <div class="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5 min-w-0 mr-3">
                  <Activity class="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <div class="min-w-0">
                    <div class="font-bold text-slate-800 dark:text-zinc-100 truncate">{{ t('healthCheck.title') || '失效检测' }}</div>
                    <div class="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {{ t('healthCheck.subtitle') || '超轻量探测 · 仅检测 404 与 403 明确状态' }}
                    </div>
                  </div>
                </div>

                <!-- Controls -->
                <div class="flex items-center gap-2 flex-shrink-0">
                  <button
                    v-if="checkerState.isRunning"
                    type="button"
                    @click="handleStopHealthCheck"
                    class="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
                  >
                    <Square class="w-3.5 h-3.5 fill-current" />
                    <span>{{ t('healthCheck.pause') || '停止' }}</span>
                  </button>
                  <button
                    v-else
                    type="button"
                    @click="startHealthCheck"
                    class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
                  >
                    <Play class="w-3 h-3 fill-current" />
                    <span>{{ checkerState.completed > 0 ? (t('healthCheck.recheck') || '重新检测') : (t('healthCheck.start') || '开始检测') }}</span>
                  </button>
                </div>
              </div>

              <!-- Scanning Progress -->
              <div v-if="checkerState.isRunning" class="space-y-1.5 pt-1 border-t border-indigo-500/15">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="text-indigo-700 dark:text-indigo-300 font-mono truncate mr-2">
                    {{ checkerState.currentUrl || checkerState.currentTitle }}
                  </span>
                  <span class="font-mono text-slate-500 flex-shrink-0">
                    {{ checkerState.completed }} / {{ checkerState.total }} ({{ healthProgressPercent }}%)
                  </span>
                </div>
                <div class="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    class="h-full bg-indigo-500 rounded-full transition-all duration-150"
                    :style="{ width: `${healthProgressPercent}%` }"
                  ></div>
                </div>
              </div>

              <!-- Localhost dev warning banner -->
              <div v-if="!isRealExtension" class="p-2 rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                {{ t('healthCheck.devNotice') }}
              </div>
            </div>

            <!-- Tab Switcher: 404 vs 403 only -->
            <div class="flex items-center gap-3 border-b border-black/5 dark:border-white/5 text-xs font-medium overflow-x-auto whitespace-nowrap">
              <button
                type="button"
                @click="healthTab = 'dead_404'"
                class="flex items-center gap-1.5 py-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
                :class="[
                  healthTab === 'dead_404'
                    ? 'border-red-600 text-red-600 dark:border-red-400 dark:text-red-400 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                ]"
              >
                <AlertOctagon class="w-3.5 h-3.5" />
                <span>{{ t('healthCheck.tab404') || '404 确定失效 (建议清理)' }}</span>
                <span
                  v-if="dead404Results.length > 0"
                  class="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-red-500 text-white"
                >
                  {{ dead404Results.length }}
                </span>
              </button>

              <button
                type="button"
                @click="healthTab = 'blocked_403'"
                class="flex items-center gap-1.5 py-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
                :class="[
                  healthTab === 'blocked_403'
                    ? 'border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                ]"
              >
                <ShieldAlert class="w-3.5 h-3.5" />
                <span>{{ t('healthCheck.tab403') || '403 / 401 拦截 (请复查)' }}</span>
                <span
                  v-if="blocked403Results.length > 0"
                  class="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500 text-white"
                >
                  {{ blocked403Results.length }}
                </span>
              </button>
            </div>

            <!-- Result List Area -->
            <div class="space-y-2 text-xs">
              <div
                v-if="displayedHealthResults.length > 0"
                class="p-2.5 rounded-xl border text-[11px] flex items-center gap-2 leading-relaxed"
                :class="[
                  healthTab === 'dead_404'
                    ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                ]"
              >
                <AlertOctagon v-if="healthTab === 'dead_404'" class="w-4 h-4 flex-shrink-0" />
                <ShieldAlert v-else class="w-4 h-4 flex-shrink-0" />
                <span>
                  {{
                    healthTab === 'dead_404'
                      ? (t('healthCheck.hint404') || '目标服务器已明确返回 404/410 页面丢失，资源已失效，可放心勾选批量清理。')
                      : (t('healthCheck.hint403') || '访问受限（通常是 Cloudflare 人机验证、防火墙防爬或需要登录授权）。网站依然在线，建议右侧打开复查，请勿随意删除。')
                  }}
                </span>
              </div>

              <!-- List -->
              <div v-if="displayedHealthResults.length > 0" class="max-h-60 overflow-y-auto space-y-1.5">
                <div
                  v-for="item in displayedHealthResults"
                  :key="item.id"
                  class="flex items-center justify-between p-2 rounded-xl border transition-colors"
                  :class="[
                    healthSelectedDeleteIds.has(item.id)
                      ? 'border-red-500/40 bg-red-500/5 dark:bg-red-500/10'
                      : 'border-slate-200/80 dark:border-white/5 bg-white/40 dark:bg-zinc-900/40'
                  ]"
                >
                  <div class="flex items-center gap-2 flex-1 min-w-0 mr-2">
                    <input
                      type="checkbox"
                      :checked="healthSelectedDeleteIds.has(item.id)"
                      @change="toggleHealthSelect(item.id)"
                      class="w-3.5 h-3.5 rounded text-red-600 cursor-pointer flex-shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-slate-800 dark:text-zinc-200 truncate">{{ item.title }}</div>
                      <div class="text-[10px] text-slate-400 dark:text-zinc-500 font-mono truncate">{{ item.url }}</div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      class="px-1.5 py-0.2 rounded font-mono text-[9px] font-semibold border"
                      :class="[
                        item.status === 'dead_404'
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      ]"
                    >
                      HTTP {{ item.httpCode }}
                    </span>
                    <a
                      :href="item.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                    >
                      <ExternalLink class="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              <!-- Empty state in tab -->
              <div
                v-else
                class="py-8 text-center text-xs text-slate-400 dark:text-zinc-500 flex flex-col items-center justify-center gap-1.5"
              >
                <CheckCircle2 v-if="checkerState.completed > 0" class="w-6 h-6 text-emerald-500 opacity-60" />
                <Activity v-else class="w-6 h-6 text-indigo-500 opacity-40" />
                <span>{{ checkerState.completed > 0 ? (t('healthCheck.noIssues') || '此分类下未发现异常书签！') : (t('healthCheck.emptyTitle') || '尚未进行失效检测，请点击上方“开始检测”') }}</span>
              </div>

              <!-- Selection controls and batch delete button -->
              <div v-if="displayedHealthResults.length > 0" class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    @click="selectAllHealthInTab"
                    class="px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-[11px] cursor-pointer"
                  >
                    {{ t('common.selectAll') || '全选本项' }}
                  </button>
                  <button
                    type="button"
                    @click="selectOnly404Health"
                    class="px-2 py-0.5 rounded border border-red-500/30 text-red-600 text-[11px] cursor-pointer"
                  >
                    {{ t('healthCheck.selectOnly404') || '仅选 404 项' }}
                  </button>
                  <button
                    type="button"
                    @click="clearHealthSelect"
                    class="text-slate-400 text-[11px] cursor-pointer hover:underline"
                  >
                    {{ t('common.clear') || '清空' }}
                  </button>
                </div>

                <button
                  type="button"
                  @click="promptHealthDelete"
                  :disabled="healthSelectedDeleteIds.size === 0 || isHealthDeleting"
                  class="px-3.5 py-1 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-medium text-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 class="w-3 h-3" />
                  <span>{{ isHealthDeleting ? (t('common.deleting') || '删除中...') : (t('healthCheck.deleteSelectedCount') || '删除选中的 {count} 项').replace('{count}', String(healthSelectedDeleteIds.size)) }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Donate / Support Tab -->
          <div v-if="activeTab === 'donate'" class="space-y-5">
            <!-- Warm Intro Banner -->
            <div class="p-4 rounded-2xl bg-gradient-to-r from-pink-500/10 via-amber-500/10 to-indigo-500/10 border border-pink-500/20 text-xs space-y-2">
              <div class="flex items-center gap-2 font-bold text-slate-900 dark:text-zinc-100 text-sm">
                <Coffee class="w-4 h-4 text-amber-500" />
                <span>{{ t('donate.headerTitle') || '请作者喝杯咖啡 ☕' }}</span>
              </div>
              <p class="text-slate-600 dark:text-zinc-300 leading-relaxed">
                {{ t('donate.introText') || '新标签页的一方天地，连接着你的效率与探索。如果 NTab 让你在每次打开新标签页时感受到清爽与从容，欢迎请开发者喝杯咖啡，支持后续持续迭代与维护！' }}
              </p>
            </div>

            <!-- Specific Channels Tabs -->
            <div class="grid grid-cols-4 gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-2xl text-xs font-medium">
              <button
                type="button"
                @click="selectedPayChannel = 'wechat'"
                class="py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                :class="[
                  selectedPayChannel === 'wechat'
                    ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                ]"
              >
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span class="truncate">{{ t('donate.wechatPay') || '微信支付' }}</span>
              </button>

              <button
                type="button"
                @click="selectedPayChannel = 'alipay'"
                class="py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                :class="[
                  selectedPayChannel === 'alipay'
                    ? 'bg-white dark:bg-zinc-800 text-sky-600 dark:text-sky-400 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                ]"
              >
                <span class="w-2 h-2 rounded-full bg-sky-500"></span>
                <span class="truncate">{{ t('donate.alipay') || '支付宝' }}</span>
              </button>

              <button
                type="button"
                @click="selectedPayChannel = 'paypal'"
                class="py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                :class="[
                  selectedPayChannel === 'paypal'
                    ? 'bg-white dark:bg-zinc-800 text-[#0070ba] dark:text-[#009cde] shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                ]"
              >
                <span class="w-2 h-2 rounded-full bg-[#0070ba]"></span>
                <span class="truncate">PayPal</span>
              </button>

              <button
                type="button"
                @click="selectedPayChannel = 'kofi'"
                class="py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                :class="[
                  selectedPayChannel === 'kofi'
                    ? 'bg-white dark:bg-zinc-800 text-[#ff5e5b] shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                ]"
              >
                <span class="w-2 h-2 rounded-full bg-[#ff5e5b]"></span>
                <span class="truncate">Ko-fi</span>
              </button>
            </div>

            <!-- WeChat Pay Panel -->
            <div v-if="selectedPayChannel === 'wechat'" class="space-y-3">
              <div class="flex flex-col items-center justify-center p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm max-w-xs mx-auto">
                <div class="w-56 h-56 rounded-xl overflow-hidden bg-white p-2 flex items-center justify-center shadow-inner">
                  <img
                    src="/img/wechatpay.png"
                    :alt="t('donate.wechatPay') || 'WeChat Pay'"
                    class="w-full h-full object-contain select-none"
                  />
                </div>
                <div class="mt-3 text-center text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                  {{ t('donate.wechatScan') || '微信扫一扫 · 赞赏支持作者' }}
                </div>
              </div>
            </div>

            <!-- Alipay Panel -->
            <div v-else-if="selectedPayChannel === 'alipay'" class="space-y-3">
              <div class="flex flex-col items-center justify-center p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm max-w-xs mx-auto">
                <div class="w-56 h-56 rounded-xl overflow-hidden bg-white p-2 flex items-center justify-center shadow-inner">
                  <img
                    src="/img/alipay.png"
                    :alt="t('donate.alipay') || 'Alipay'"
                    class="w-full h-full object-contain select-none"
                  />
                </div>
                <div class="mt-3 text-center text-[11px] font-medium text-slate-700 dark:text-zinc-300">
                  {{ t('donate.alipayScan') || '支付宝扫一扫 · 赞赏支持作者' }}
                </div>
              </div>
            </div>

            <!-- PayPal Panel -->
            <div v-else-if="selectedPayChannel === 'paypal'" class="space-y-4 max-w-sm mx-auto">
              <div class="text-center text-xs text-slate-500 dark:text-zinc-400">
                {{ t('donate.paypalTip') || '支持国际信用卡、借记卡及 PayPal 账户安全支付：' }}
              </div>
              <a
                :href="PAYPAL_DONATE_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#0070ba]/10 hover:bg-[#0070ba]/15 border border-[#0070ba]/30 text-[#0070ba] dark:text-[#009cde] font-semibold text-xs transition-all shadow-xs cursor-pointer group"
              >
                <div class="flex items-center gap-2.5">
                  <span class="text-lg">💳</span>
                  <div>
                    <div>Donate with PayPal</div>
                    <div class="text-[10px] font-normal opacity-75">NTab Extension Support</div>
                  </div>
                </div>
                <ExternalLink class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>

            <!-- Ko-fi Panel -->
            <div v-else-if="selectedPayChannel === 'kofi'" class="space-y-4 max-w-sm mx-auto">
              <div class="text-center text-xs text-slate-500 dark:text-zinc-400">
                {{ t('donate.kofiTip') || '支持 Apple Pay、Google Pay 及国际银行卡小额赞助：' }}
              </div>
              <a
                :href="KOFI_DONATE_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#ff5e5b]/10 hover:bg-[#ff5e5b]/15 border border-[#ff5e5b]/30 text-[#ff5e5b] font-semibold text-xs transition-all shadow-xs cursor-pointer group"
              >
                <div class="flex items-center gap-2.5">
                  <span class="text-lg">☕</span>
                  <div>
                    <div>Tip on Ko-fi</div>
                    <div class="text-[10px] font-normal opacity-75">Support NTab on Ko-fi</div>
                  </div>
                </div>
                <ExternalLink class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>

          <div v-if="activeTab === 'backup'" class="space-y-4">
            <!-- Google Cloud Sync Card -->
            <div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-3.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5 min-w-0 mr-3">
                  <div class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center p-1.5 shadow-2xs flex-shrink-0">
                    <SearchEngineIcon engine-id="google" size-class="w-5 h-5" />
                  </div>
                  <div class="min-w-0">
                    <div class="font-bold text-xs text-slate-800 dark:text-zinc-100 flex items-center gap-1.5 truncate">
                      <span>{{ t('auth.googleSyncTitle') || 'Google 账号云同步' }}</span>
                      <span class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium flex-shrink-0">
                        {{ t('auth.offlineSupported') || '免登录可用' }}
                      </span>
                    </div>
                    <div class="text-[11px] text-slate-400 truncate">
                      {{ t('auth.googleSyncDesc') || '自动在云端备份排版布局与个性化设置，换机登录一键快速恢复' }}
                    </div>
                  </div>
                </div>

                <button
                  v-if="currentGoogleUser"
                  type="button"
                  @click="logoutGoogle"
                  class="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-500 hover:text-red-500 hover:border-red-500/30 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
                >
                  {{ t('auth.signOut') || '退出登录' }}
                </button>
              </div>

              <!-- Logged-in Profile & Cloud Controls -->
              <div v-if="currentGoogleUser" class="pt-2 border-t border-slate-100 dark:border-zinc-800/80 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <img
                      v-if="currentGoogleUser.picture"
                      :src="currentGoogleUser.picture"
                      class="w-7 h-7 rounded-full object-cover ring-2 ring-indigo-500/30"
                      alt=""
                    />
                    <div v-else class="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                      {{ currentGoogleUser.name.charAt(0).toUpperCase() }}
                    </div>
                    <div>
                      <div class="font-semibold text-xs text-slate-900 dark:text-zinc-100">{{ currentGoogleUser.name }}</div>
                      <div class="text-[10px] text-slate-400 font-mono">{{ currentGoogleUser.email }}</div>
                    </div>
                  </div>

                  <div class="text-right text-[10px] text-slate-400 font-mono">
                    <div v-if="lastSyncedTime">{{ t('auth.lastSynced') || '上次同步' }}: {{ lastSyncedTime }}</div>
                    <div v-if="syncStatusMessage" class="text-indigo-600 dark:text-indigo-400 font-sans font-medium">{{ syncStatusMessage }}</div>
                  </div>
                </div>

                <div class="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    @click="backupToGoogleCloud"
                    :disabled="isSyncing"
                    class="flex-1 py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Upload class="w-3.5 h-3.5" />
                    <span>{{ isSyncing ? (t('auth.syncing') || '正在同步...') : (t('auth.backupNow') || '备份当前配置到云端') }}</span>
                  </button>

                  <button
                    type="button"
                    @click="restoreFromGoogleCloud"
                    :disabled="isSyncing"
                    class="flex-1 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50 text-slate-700 dark:text-zinc-300 font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download class="w-3.5 h-3.5" />
                    <span>{{ t('auth.restoreNow') || '从云端恢复配置' }}</span>
                  </button>
                </div>
              </div>

              <!-- Logged-out State: Sign in with Google -->
              <div v-else class="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-4">
                <div class="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
                  {{ t('auth.guestTip') || 'NTab 默认完整支持离线免登录使用。登录谷歌仅用于个人云端备份，不影响本地书签。' }}
                </div>
                <button
                  type="button"
                  @click="loginWithGoogle()"
                  class="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 hover:border-slate-300 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 font-semibold text-xs shadow-xs hover:shadow transition-all cursor-pointer flex items-center gap-2 flex-shrink-0"
                >
                  <SearchEngineIcon engine-id="google" size-class="w-4 h-4" />
                  <span>{{ t('auth.signInWithGoogle') || 'Google 账号登录' }}</span>
                </button>
              </div>
            </div>

            <div
              @click="isAdvancedModalOpen = true"
              class="flex items-center justify-between p-3.5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors cursor-pointer group select-none"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
                  <Code2 class="w-4 h-4" />
                </div>
                <div>
                  <div class="font-bold text-xs text-indigo-900 dark:text-indigo-200">
                    {{ t('settings.openAdvancedEditor') }}
                  </div>
                  <div class="text-[11px] text-slate-500 dark:text-zinc-400">
                    {{ t('settings.advancedEditorSubtitle') }}
                  </div>
                </div>
              </div>
              <span class="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600 text-white shadow-xs flex-shrink-0 ml-2">
                {{ t('common.edit') }}
              </span>
            </div>

            <div class="pt-2">
              <label class="block font-medium text-xs text-slate-700 dark:text-zinc-300 mb-1.5">{{ t('settings.exportConfig') }}</label>
              <textarea
                readonly
                :value="exportJson"
                class="w-full h-24 p-2 text-xs font-mono bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none"
              ></textarea>
              <div class="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  @click="handleCopyConfig"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  <Download class="w-3.5 h-3.5" />
                  <span>{{ isCopied ? t('settings.copied') : t('settings.copyConfig') }}</span>
                </button>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-zinc-800">
              <label class="block font-medium text-xs text-slate-700 dark:text-zinc-300 mb-1.5">{{ t('settings.importConfig') }}</label>
              <textarea
                v-model="importJson"
                :placeholder="t('settings.importPlaceholder')"
                class="w-full h-24 p-2 text-xs font-mono bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-indigo-500"
              ></textarea>
              <button
                type="button"
                @click="handleImport"
                :disabled="!importJson.trim()"
                class="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Upload class="w-3.5 h-3.5" />
                <span>{{ t('settings.importButton') }}</span>
              </button>
              <span v-if="importSuccess" class="ml-2 text-xs text-emerald-500 font-medium">{{ t('settings.importSuccess') }}</span>
            </div>
          </div>
        </div>

        <div class="px-6 py-3 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs text-slate-400">
          <div class="flex items-center gap-3">
            <span>NTab</span>
            <button
              type="button"
              @click="toggleDemoMode(); emit('close')"
              class="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium transition-colors cursor-pointer"
              :title="isDemoMode ? 'Exit Demo Showcase' : 'Enter 100% Private Demo Showcase with Global Tech Bookmarks'"
            >
              <Camera class="w-3.5 h-3.5" />
              <span>{{ isDemoMode ? (t('settings.exitDemo') || '退出展示模式') : (t('settings.enterDemo') || '📷 宣传展示模式') }}</span>
            </button>
            <button
              type="button"
              @click="activeTab = 'donate'"
              class="flex items-center gap-1.5 text-pink-600 dark:text-pink-400 hover:underline font-medium transition-colors cursor-pointer"
            >
              <Heart class="w-3.5 h-3.5 fill-pink-500/20" />
              <span>{{ t('settings.tabDonate') || '赞赏支持' }}</span>
            </button>
          </div>
          <button
            type="button"
            @click="emit('close')"
            class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors cursor-pointer"
          >
            {{ t('common.close') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <AdvancedConfigModal
    :is-open="isAdvancedModalOpen"
    @close="isAdvancedModalOpen = false"
  />

  <ConfirmDeleteModal
    :is-open="isHealthConfirmOpen"
    :title="t('healthCheck.deleteConfirmTitle') || '批量删除失效书签'"
    :description="(t('healthCheck.deleteConfirmMsg') || '确定从浏览器中彻底永久删除选中的 {count} 个书签吗？此操作无法撤销。').replace('{count}', String(healthSelectedDeleteIds.size))"
    @cancel="isHealthConfirmOpen = false"
    @confirm="handleConfirmedHealthDelete"
  />
</template>
