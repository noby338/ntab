<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  X,
  Activity,
  AlertOctagon,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Play,
  Square,
  RotateCcw,
  CheckSquare,
} from '@lucide/vue';
import {
  checkerState,
  runBookmarkHealthCheck,
  stopBookmarkHealthCheck,
  extractAllLeafBookmarks,
  type BookmarkCheckResult,
} from '../services/bookmarkChecker';
import { rawBookmarkTree, batchRemoveBookmarks } from '../services/bookmarks';
import { isRealExtension } from '../services/googleAuthService';
import ConfirmDeleteModal from './ConfirmDeleteModal.vue';
import { t } from '../locales';
import type { BookmarkItem } from '../types';

const props = defineProps<{
  isOpen: boolean;
  selectedBookmarkIds?: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const activeTab = ref<'dead_404' | 'blocked_403' | 'timeout' | 'all'>('dead_404');
const selectedDeleteIds = ref<Set<string>>(new Set());
const checkScope = ref<'all' | 'selected'>('all');
const isDeleting = ref(false);
const isConfirmDeleteOpen = ref(false);

const allLeafBookmarks = computed<BookmarkItem[]>(() => {
  return extractAllLeafBookmarks(rawBookmarkTree.value);
});

const selectedLeafBookmarks = computed<BookmarkItem[]>(() => {
  if (!props.selectedBookmarkIds || props.selectedBookmarkIds.size === 0) return [];
  return allLeafBookmarks.value.filter((b) => props.selectedBookmarkIds?.has(b.id));
});

const totalToCheckCount = computed(() => {
  return checkScope.value === 'selected' && selectedLeafBookmarks.value.length > 0
    ? selectedLeafBookmarks.value.length
    : allLeafBookmarks.value.length;
});

const progressPercent = computed(() => {
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

const timeoutResults = computed(() => {
  return checkerState.value.results.filter(
    (r) => r.status === 'timeout' || r.status === 'unreachable' || r.status === 'server_error'
  );
});

const displayedResults = computed(() => {
  if (activeTab.value === 'dead_404') return dead404Results.value;
  if (activeTab.value === 'blocked_403') return blocked403Results.value;
  if (activeTab.value === 'timeout') return timeoutResults.value;
  return checkerState.value.results.filter((r) => r.status !== 'ok');
});

// Auto pre-select dead 404s when results come in
watch(
  () => dead404Results.value.length,
  () => {
    const set = new Set(selectedDeleteIds.value);
    for (const item of dead404Results.value) {
      set.add(item.id);
    }
    selectedDeleteIds.value = set;
  }
);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      if (props.selectedBookmarkIds && props.selectedBookmarkIds.size > 0) {
        checkScope.value = 'selected';
      } else {
        checkScope.value = 'all';
      }
    } else {
      stopBookmarkHealthCheck();
    }
  }
);

function startCheck() {
  const targetItems =
    checkScope.value === 'selected' && selectedLeafBookmarks.value.length > 0
      ? selectedLeafBookmarks.value.length > 0
        ? selectedLeafBookmarks.value
        : allLeafBookmarks.value
      : allLeafBookmarks.value;

  selectedDeleteIds.value.clear();
  runBookmarkHealthCheck(targetItems);
}

function handleStop() {
  stopBookmarkHealthCheck();
}

function toggleSelect(id: string) {
  const set = new Set(selectedDeleteIds.value);
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  selectedDeleteIds.value = set;
}

function selectAllInCurrentTab() {
  const set = new Set(selectedDeleteIds.value);
  for (const item of displayedResults.value) {
    set.add(item.id);
  }
  selectedDeleteIds.value = set;
}

function clearSelectInCurrentTab() {
  const set = new Set(selectedDeleteIds.value);
  for (const item of displayedResults.value) {
    set.delete(item.id);
  }
  selectedDeleteIds.value = set;
}

function selectOnly404() {
  selectedDeleteIds.value = new Set(dead404Results.value.map((r) => r.id));
  activeTab.value = 'dead_404';
}

function promptDeleteSelected() {
  if (selectedDeleteIds.value.size === 0) return;
  isConfirmDeleteOpen.value = true;
}

async function handleConfirmedDelete() {
  isConfirmDeleteOpen.value = false;
  const ids = Array.from(selectedDeleteIds.value);
  if (ids.length === 0) return;

  isDeleting.value = true;
  try {
    await batchRemoveBookmarks(ids);
    checkerState.value.results = checkerState.value.results.filter(
      (r) => !selectedDeleteIds.value.has(r.id)
    );
    selectedDeleteIds.value.clear();
  } finally {
    isDeleting.value = false;
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
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-2xl h-[680px] max-h-[92vh] flex flex-col theme-popover rounded-3xl shadow-2xl overflow-hidden"
      >
        <!-- Modal Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/5">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Activity class="w-5 h-5" />
            </div>
            <div>
              <div class="font-bold text-base text-slate-900 dark:text-zinc-100">
                {{ t('healthCheck.title') || '书签失效健康体检' }}
              </div>
              <div class="text-[11px] text-slate-400 dark:text-zinc-500">
                {{ t('healthCheck.subtitle') || '超轻量 HEAD 探测 · 零流量浪费 · 区分 404 与 403' }}
              </div>
            </div>
          </div>
          <button
            type="button"
            @click="emit('close')"
            class="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <div v-if="!isRealExtension" class="mx-6 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2 select-text">
          <span class="text-sm flex-shrink-0">⚠️</span>
          <span class="leading-relaxed">
            当前处于<strong>本地网页调试模式 (localhost)</strong>，受浏览器 CORS 安全策略强制限制，大部分外部网页无法通过前端直接跨域请求。请在 Chrome 扩展管理中以<strong>「已解压的扩展程序」</strong>加载 <code>.output/chrome-mv3</code>，扩展拥有完整跨域权限，可进行 100% 准确探测。
          </span>
        </div>

        <!-- Scan Status Banner & Trigger -->
        <div class="px-6 py-3.5 border-b border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2">
          <!-- Scanning Progress Bar -->
          <div v-if="checkerState.isRunning" class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                <span>{{ t('healthCheck.checkingProgress') || '正在探测' }}</span>
                <span class="font-mono">({{ checkerState.completed }} / {{ checkerState.total }})</span>
              </span>
              <span class="font-mono text-slate-500">{{ progressPercent }}%</span>
            </div>

            <!-- Progress Track -->
            <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-150 rounded-full"
                :style="{ width: `${progressPercent}%` }"
              ></div>
            </div>

            <div class="flex items-center justify-between gap-4 text-[11px] text-slate-400 dark:text-zinc-500">
              <span class="truncate flex-1 font-mono">
                {{ checkerState.currentUrl || checkerState.currentTitle }}
              </span>
              <button
                type="button"
                @click="handleStop"
                class="px-2.5 py-0.5 rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer font-medium flex items-center gap-1"
              >
                <Square class="w-3 h-3" />
                <span>{{ t('healthCheck.pause') || '停止' }}</span>
              </button>
            </div>
          </div>

          <!-- Idle State Trigger -->
          <div v-else class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-2">
              <select
                v-model="checkScope"
                class="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
              >
                <option value="all">
                  {{ t('healthCheck.scopeAll') || '检测全部书签' }} ({{ allLeafBookmarks.length }})
                </option>
                <option v-if="selectedLeafBookmarks.length > 0" value="selected">
                  {{ t('healthCheck.scopeSelected') || '仅检测选中的书签' }} ({{ selectedLeafBookmarks.length }})
                </option>
              </select>

              <button
                type="button"
                @click="startCheck"
                class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Play class="w-3.5 h-3.5 fill-current" />
                <span>{{ checkerState.completed > 0 ? (t('healthCheck.recheck') || '重新体检') : (t('healthCheck.start') || '开始体检') }}</span>
              </button>
            </div>

            <!-- Summary Badges if checked -->
            <div v-if="checkerState.results.length > 0" class="flex items-center gap-2 text-xs">
              <span class="px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-medium">
                404: {{ dead404Results.length }}
              </span>
              <span class="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                403: {{ blocked403Results.length }}
              </span>
              <span class="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-zinc-400 border border-slate-500/20 font-medium">
                超时: {{ timeoutResults.length }}
              </span>
            </div>
          </div>
        </div>

        <!-- Categorized Tabs: 404 vs 403 Segregation -->
        <div class="flex items-center px-6 gap-2 border-b border-black/5 dark:border-white/5 bg-black/1 dark:bg-white/1 text-xs font-medium">
          <button
            type="button"
            @click="activeTab = 'dead_404'"
            class="flex items-center gap-1.5 py-2.5 border-b-2 transition-colors cursor-pointer"
            :class="[
              activeTab === 'dead_404'
                ? 'border-red-600 text-red-600 dark:border-red-400 dark:text-red-400'
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
            @click="activeTab = 'blocked_403'"
            class="flex items-center gap-1.5 py-2.5 border-b-2 transition-colors cursor-pointer"
            :class="[
              activeTab === 'blocked_403'
                ? 'border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400'
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

          <button
            type="button"
            @click="activeTab = 'timeout'"
            class="flex items-center gap-1.5 py-2.5 border-b-2 transition-colors cursor-pointer"
            :class="[
              activeTab === 'timeout'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            ]"
          >
            <Clock class="w-3.5 h-3.5" />
            <span>{{ t('healthCheck.tabTimeout') || '超时 / 无法连接' }}</span>
            <span
              v-if="timeoutResults.length > 0"
              class="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-500 text-white"
            >
              {{ timeoutResults.length }}
            </span>
          </button>
        </div>

        <!-- Result List Area -->
        <div class="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
          <!-- Category Tip Banner -->
          <div
            v-if="displayedResults.length > 0"
            class="p-2.5 rounded-xl border text-[11px] flex items-center gap-2 leading-relaxed"
            :class="[
              activeTab === 'dead_404'
                ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                : activeTab === 'blocked_403'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-zinc-400'
            ]"
          >
            <AlertOctagon v-if="activeTab === 'dead_404'" class="w-4 h-4 flex-shrink-0" />
            <ShieldAlert v-else-if="activeTab === 'blocked_403'" class="w-4 h-4 flex-shrink-0" />
            <Clock v-else class="w-4 h-4 flex-shrink-0" />
            <span>
              {{
                activeTab === 'dead_404'
                  ? (t('healthCheck.hint404') || '目标服务器已明确返回 404/410 页面丢失，资源已失效，可放心勾选批量清理。')
                  : activeTab === 'blocked_403'
                  ? (t('healthCheck.hint403') || '访问受限（通常是 Cloudflare 人机验证、防火墙防爬或需要登录授权）。网站依然在线，建议右侧打开复查，请勿随意删除。')
                  : (t('healthCheck.hintTimeout') || '连接超时或未响应。通常由于国际网络延迟或部分服务需要特定代理环境。如能在浏览器正常打开请勿删除。')
              }}
            </span>
          </div>

          <div v-if="displayedResults.length > 0" class="space-y-1.5">
            <div
              v-for="item in displayedResults"
              :key="item.id"
              class="flex items-center justify-between p-2.5 rounded-xl border transition-colors group"
              :class="[
                selectedDeleteIds.has(item.id)
                  ? 'border-red-500/40 bg-red-500/5 dark:bg-red-500/10'
                  : 'border-slate-200/80 dark:border-white/5 bg-white/40 dark:bg-zinc-900/40 hover:bg-slate-50 dark:hover:bg-zinc-800/40'
              ]"
            >
              <!-- Checkbox + Title & URL -->
              <div class="flex items-center gap-2.5 flex-1 min-w-0 mr-3">
                <input
                  type="checkbox"
                  :checked="selectedDeleteIds.has(item.id)"
                  @change="toggleSelect(item.id)"
                  class="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer flex-shrink-0"
                />

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 font-medium text-slate-800 dark:text-zinc-200 truncate">
                    <span class="truncate">{{ item.title }}</span>
                    <span v-if="item.parentPath" class="text-[10px] text-slate-400 dark:text-zinc-500 font-normal truncate">
                      ({{ item.parentPath }})
                    </span>
                  </div>
                  <div class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono truncate">
                    {{ item.url }}
                  </div>
                </div>
              </div>

              <!-- Badges + Actions -->
              <div class="flex items-center gap-2 flex-shrink-0">
                <!-- Status tag -->
                <span
                  class="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold border"
                  :class="[
                    item.status === 'dead_404'
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                      : item.status === 'blocked_403'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-slate-500/10 text-slate-600 dark:text-zinc-400 border-slate-500/20'
                  ]"
                >
                  {{ item.httpCode ? `HTTP ${item.httpCode}` : item.status }}
                </span>

                <!-- Test in new tab button -->
                <a
                  :href="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="t('healthCheck.openToVerify') || '在新标签页打开核对'"
                  class="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  <ExternalLink class="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-else
            class="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-zinc-500 gap-2"
          >
            <template v-if="checkerState.completed === 0 && !checkerState.isRunning">
              <Activity class="w-8 h-8 opacity-40 text-indigo-500 mb-1" />
              <div class="font-medium text-sm text-slate-700 dark:text-zinc-300">
                {{ t('healthCheck.emptyTitle') || '尚未进行书签体检' }}
              </div>
              <div class="text-xs max-w-sm leading-relaxed">
                {{ t('healthCheck.emptyDesc') || '点击上方“开始体检”按钮，将以极低流量并发探测所有书签的 HTTP 状态。' }}
              </div>
            </template>
            <template v-else-if="checkerState.isRunning">
              <div class="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-1"></div>
              <div class="text-sm font-medium text-slate-700 dark:text-zinc-300">
                {{ t('healthCheck.scanning') || '正在探测中...' }}
              </div>
            </template>
            <template v-else>
              <CheckCircle2 class="w-8 h-8 opacity-50 text-emerald-500 mb-1" />
              <div class="font-medium text-sm text-slate-700 dark:text-zinc-300">
                {{ t('healthCheck.noIssues') || '当前分类下没有发现异常书签！' }}
              </div>
            </template>
          </div>
        </div>

        <!-- Bottom Action Bar -->
        <div class="px-6 py-3 border-t border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
          <!-- Selection controls -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="selectAllInCurrentTab"
              :disabled="displayedResults.length === 0"
              class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {{ t('common.selectAll') || '本类全选' }}
            </button>
            <button
              type="button"
              @click="selectOnly404"
              :disabled="dead404Results.length === 0"
              class="px-2.5 py-1 rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors cursor-pointer font-medium"
            >
              {{ t('healthCheck.selectOnly404') || '仅选 404 失效项' }} ({{ dead404Results.length }})
            </button>
            <button
              type="button"
              @click="clearSelectInCurrentTab"
              :disabled="selectedDeleteIds.size === 0"
              class="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
            >
              {{ t('common.clear') || '清空勾选' }}
            </button>
          </div>

          <!-- Delete Action button -->
          <div class="flex items-center gap-2">
            <span class="text-slate-400 font-mono">
              {{ t('healthCheck.selectedCount', { count: selectedDeleteIds.size }) || `已选 ${selectedDeleteIds.size} 项` }}
            </span>
            <button
              type="button"
              @click="promptDeleteSelected"
              :disabled="selectedDeleteIds.size === 0 || isDeleting"
              class="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-medium shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>{{ isDeleting ? (t('common.deleting') || '正在删除...') : (t('healthCheck.deleteSelected') || '一键删除勾选项') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Reusable Unified Confirm Delete Modal -->
  <ConfirmDeleteModal
    :is-open="isConfirmDeleteOpen"
    :title="t('confirmDelete.batchTitle', { count: selectedDeleteIds.size })"
    :description="t('confirmDelete.batchDesc', { count: selectedDeleteIds.size })"
    @confirm="handleConfirmedDelete"
    @cancel="isConfirmDeleteOpen = false"
  />
</template>
