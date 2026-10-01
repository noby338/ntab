<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  Settings,
  CheckSquare,
  FolderPlus,
  EyeOff,
  Activity,
  Heart,
} from '@lucide/vue';
import {
  loadBookmarks,
  setupBookmarkListeners,
  rawBookmarkTree,
  folderMap,
  isLoaded,
  batchRemoveBookmarks,
  moveBookmark,
  removeBookmark,
} from '../../src/services/bookmarks';
import {
  userSettings,
  loadSettings,
  columnLayout,
  loadColumnLayout,
  saveColumnLayout,
  removeFromColumnLayout,
} from '../../src/services/storage';
import BookmarkColumn from '../../src/components/BookmarkColumn.vue';
import SearchBar from '../../src/components/SearchBar.vue';
import BatchActionBar from '../../src/components/BatchActionBar.vue';
import SettingsModal from '../../src/components/SettingsModal.vue';
import ContextMenu from '../../src/components/ContextMenu.vue';
import CreateFolderModal from '../../src/components/CreateFolderModal.vue';
import ConfirmDeleteModal from '../../src/components/ConfirmDeleteModal.vue';
import BookmarkHealthModal from '../../src/components/BookmarkHealthModal.vue';
import SearchEngineIcon from '../../src/components/SearchEngineIcon.vue';
import { currentGoogleUser, loginWithGoogle } from '../../src/services/googleAuthService';
import { initGlobalDragScroll, isGlobalDragging, globalDragType, endGlobalDrag } from '../../src/services/dragScroll';
import {
  activeDropTarget,
  activeDragCardInfo,
  resolveDropTarget,
  endCardDrag,
} from '../../src/services/cardDragCoordinator';
import { t, activeLanguage } from '../../src/locales';
import { getActiveShortcut, matchesShortcut } from '../../src/services/hotkeyService';
import type { BookmarkItem } from '../../src/types';

// State
const isBatchMode = ref(false);
const isHealthModalOpen = ref(false);
const isCornerActive = ref(false);
const isButtonsHovered = ref(false);
let cornerCloseTimer: ReturnType<typeof setTimeout> | null = null;

function handleCornerEnter() {
  if (cornerCloseTimer) {
    clearTimeout(cornerCloseTimer);
    cornerCloseTimer = null;
  }
  isCornerActive.value = true;
}

function handleCornerLeave() {
  if (cornerCloseTimer) clearTimeout(cornerCloseTimer);
  cornerCloseTimer = setTimeout(() => {
    isCornerActive.value = false;
    isButtonsHovered.value = false;
  }, 350);
}

function handleButtonsEnter() {
  if (cornerCloseTimer) {
    clearTimeout(cornerCloseTimer);
    cornerCloseTimer = null;
  }
  isButtonsHovered.value = true;
}

function handleButtonsLeave() {
  if (cornerCloseTimer) clearTimeout(cornerCloseTimer);
  cornerCloseTimer = setTimeout(() => {
    isCornerActive.value = false;
    isButtonsHovered.value = false;
  }, 350);
}

const selectedIds = ref<Set<string>>(new Set());
const isSettingsOpen = ref(false);
const settingsInitialTab = ref<'appearance' | 'layout' | 'shortcuts' | 'donate' | 'backup'>('appearance');

function openDonateSettings() {
  settingsInitialTab.value = 'donate';
  isSettingsOpen.value = true;
}

function openGeneralSettings() {
  settingsInitialTab.value = 'appearance';
  isSettingsOpen.value = true;
}

const isCreateFolderOpen = ref(false);
const createFolderParentId = ref('2');

const deleteModalState = ref<{
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
}>({
  isOpen: false,
  title: '',
  description: '',
  onConfirm: async () => {},
});

function openDeleteModal(title: string, description: string, onConfirm: () => Promise<void>) {
  deleteModalState.value = {
    isOpen: true,
    title,
    description,
    onConfirm,
  };
}

async function handleConfirmDelete() {
  deleteModalState.value.isOpen = false;
  await deleteModalState.value.onConfirm();
}

function openCreateFolder(parentId = '2') {
  createFolderParentId.value = parentId;
  isCreateFolderOpen.value = true;
}

const contextMenuState = ref<{
  isOpen: boolean;
  node: BookmarkItem | null;
  x: number;
  y: number;
}>({
  isOpen: false,
  node: null,
  x: 0,
  y: 0,
});

function handleOpenContextMenu(payload: { node: BookmarkItem; x: number; y: number }) {
  contextMenuState.value = {
    isOpen: true,
    node: payload.node,
    x: payload.x,
    y: payload.y,
  };
}

// Clock
const currentTime = ref('');
const currentDate = ref('');
let clockTimer: ReturnType<typeof setInterval> | null = null;

function updateClock() {
  const now = new Date();
  let rawHours = now.getHours();
  let period = '';
  if (userSettings.value.clockFormat === '12h') {
    period = rawHours >= 12 ? ' PM' : ' AM';
    rawHours = rawHours % 12 || 12;
  }
  const hours = String(rawHours).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  if (userSettings.value.clockShowSeconds) {
    currentTime.value = `${hours}:${minutes}:${seconds}${period}`;
  } else {
    currentTime.value = `${hours}:${minutes}${period}`;
  }

  currentDate.value = now.toLocaleDateString(activeLanguage.value, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

// Multi-selection
function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
  // Auto-enable batch mode if at least 1 item is selected
  isBatchMode.value = selectedIds.value.size > 0;
}

function clearSelection() {
  selectedIds.value.clear();
  isBatchMode.value = false;
}

function handleBatchDelete() {
  const ids = Array.from(selectedIds.value);
  if (ids.length === 0) return;
  openDeleteModal(
    t('confirmDelete.batchTitle', { count: ids.length }),
    t('confirmDelete.batchDesc', { count: ids.length }),
    async () => {
      await batchRemoveBookmarks(ids);
      clearSelection();
    }
  );
}

async function handleBatchMove(targetFolderId: string) {
  const ids = Array.from(selectedIds.value);
  for (const id of ids) {
    await moveBookmark(id, targetFolderId);
  }
  clearSelection();
}

// Folder card layout movement
function handleMoveFolder(payload: {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  direction?: 'before' | 'after' | 'left' | 'right' | 'slot' | 'card_slot';
  slotIndex?: number;
}) {
  const cols = [...columnLayout.value.columns.map((c) => [...c])];
  const { fromCol, fromRow, toCol, toRow, direction, slotIndex } = payload;

  const sourceCol = cols[fromCol];
  if (!sourceCol || !sourceCol[fromRow]) return;

  const movedId = sourceCol.splice(fromRow, 1)[0];
  if (!movedId) return;

  if (direction === 'slot' && slotIndex !== undefined) {
    const hadEmptySource = sourceCol.length === 0;
    const cleanCols = cols.filter((c) => c.length > 0);
    let targetSlot = slotIndex;
    if (hadEmptySource && fromCol < slotIndex) {
      targetSlot = Math.max(0, slotIndex - 1);
    }
    cleanCols.splice(targetSlot, 0, [movedId]);
    saveColumnLayout({ columns: cleanCols.length > 0 ? cleanCols : [[movedId]] });
    return;
  }

  if (direction === 'card_slot' && slotIndex !== undefined) {
    if (fromCol === toCol) {
      let insertIdx = slotIndex;
      if (fromRow < slotIndex) {
        insertIdx = Math.max(0, slotIndex - 1);
      }
      sourceCol.splice(insertIdx, 0, movedId);
    } else {
      const targetCol = cols[toCol] || [];
      if (!cols[toCol]) cols[toCol] = targetCol;
      targetCol.splice(slotIndex, 0, movedId);
    }
    const cleanCols = cols.filter((c) => c.length > 0);
    saveColumnLayout({ columns: cleanCols.length > 0 ? cleanCols : [[movedId]] });
    return;
  }

  if (direction === 'left') {
    cols.splice(toCol, 0, [movedId]);
  } else if (direction === 'right') {
    cols.splice(toCol + 1, 0, [movedId]);
  } else {
    const targetCol = cols[toCol] || [];
    if (!cols[toCol]) cols[toCol] = targetCol;

    let insertIndex = toRow;
    if (direction === 'after') {
      insertIndex = Math.min(toRow + 1, targetCol.length);
    }
    targetCol.splice(insertIndex, 0, movedId);
  }

  const cleaned = cols.filter((c) => c.length > 0);
  saveColumnLayout({ columns: cleaned.length > 0 ? cleaned : [[movedId]] });
}

function handleMainDragOver(event: DragEvent) {
  if (globalDragType.value !== 'folder_card' && globalDragType.value !== 'folder') return;
  event.preventDefault();
  if (!event.dataTransfer) return;
  event.dataTransfer.dropEffect = 'move';

  const target = resolveDropTarget(event.clientX, event.clientY);
  activeDropTarget.value = target;
}

function handleMainDragLeave(event: DragEvent) {
  const current = event.currentTarget as HTMLElement | null;
  const related = event.relatedTarget as HTMLElement | null;
  if (current && related && current.contains(related)) return;
  activeDropTarget.value = null;
}

async function handleMainDrop(event: DragEvent) {
  if (globalDragType.value !== 'folder_card' && globalDragType.value !== 'folder') return;
  event.preventDefault();
  const target = activeDropTarget.value;
  const dragged = activeDragCardInfo.value;
  endCardDrag();
  endGlobalDrag();

  if (!target || !dragged) return;

  const isFromNestedFolder = dragged.fromCol === -1;

  if (target.type === 'column_slot') {
    if (isFromNestedFolder) {
      await moveBookmark(dragged.id, '2');
      const currentCols = [...columnLayout.value.columns.map((c) => [...c])];
      currentCols.splice(target.slotIndex, 0, [dragged.id]);
      const cleanCols = currentCols.filter((c) => c.length > 0);
      saveColumnLayout({ columns: cleanCols.length > 0 ? cleanCols : [[dragged.id]] });
      await loadBookmarks();
    } else {
      handleMoveFolder({
        fromCol: dragged.fromCol,
        fromRow: dragged.fromRow,
        toCol: target.slotIndex,
        toRow: 0,
        direction: 'slot',
        slotIndex: target.slotIndex,
      });
    }
  } else if (target.type === 'card_slot') {
    if (isFromNestedFolder) {
      await moveBookmark(dragged.id, '2');
      const currentCols = [...columnLayout.value.columns.map((c) => [...c])];
      const targetCol = currentCols[target.colIndex] || [];
      if (!currentCols[target.colIndex]) currentCols[target.colIndex] = targetCol;
      targetCol.splice(target.slotIndex, 0, dragged.id);
      const cleanCols = currentCols.filter((c) => c.length > 0);
      saveColumnLayout({ columns: cleanCols.length > 0 ? cleanCols : [[dragged.id]] });
      await loadBookmarks();
    } else {
      handleMoveFolder({
        fromCol: dragged.fromCol,
        fromRow: dragged.fromRow,
        toCol: target.colIndex,
        toRow: target.slotIndex,
        direction: 'card_slot',
        slotIndex: target.slotIndex,
      });
    }
  } else if (target.type === 'folder_nest') {
    const ok = await moveBookmark(dragged.id, target.folderId);
    if (ok) {
      removeFromColumnLayout(dragged.id);
      await loadBookmarks();
    }
  }
}

function handleDeleteItem(id: string, isFolder: boolean) {
  const item = folderMap.value.get(id);
  const title = item?.title || t('common.unnamed');
  openDeleteModal(
    isFolder
      ? t('confirmDelete.singleFolderTitle', { title })
      : t('confirmDelete.singleBookmarkTitle', { title }),
    isFolder
      ? t('confirmDelete.singleFolderDesc', { title })
      : t('confirmDelete.singleBookmarkDesc', { title }),
    async () => {
      const ok = await removeBookmark(id, isFolder);
      if (ok && isFolder) {
        removeFromColumnLayout(id);
      }
    }
  );
}

const displayedColumns = computed(() => {
  return columnLayout.value.columns
    .map((col) => {
      return col.filter((folderId) => {
        if (folderId === 'top_sites') return userSettings.value.showTopSites;
        if (folderId === 'recently_closed') return userSettings.value.showRecentlyClosed;
        if (folderId === 'apps') return userSettings.value.showApps;
        return !userSettings.value.hiddenFolderIds?.includes(folderId);
      });
    })
    .filter((col) => col.length > 0);
});

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isHealthModalOpen.value) {
      isHealthModalOpen.value = false;
      return;
    }
    if (deleteModalState.value.isOpen) {
      deleteModalState.value.isOpen = false;
      return;
    }
    if (isCreateFolderOpen.value) {
      isCreateFolderOpen.value = false;
      return;
    }
    if (isSettingsOpen.value) {
      isSettingsOpen.value = false;
      return;
    }
    if (isBatchMode.value) {
      clearSelection();
      return;
    }
  }

  const activeEl = document.activeElement;
  const isEditing =
    activeEl?.tagName === 'INPUT' ||
    activeEl?.tagName === 'TEXTAREA' ||
    activeEl?.getAttribute('contenteditable') === 'true';

  if (!isEditing) {
    if (matchesShortcut(e, getActiveShortcut('newFolder'))) {
      e.preventDefault();
      openCreateFolder('1');
      return;
    }
    if (matchesShortcut(e, getActiveShortcut('toggleBatch'))) {
      e.preventDefault();
      isBatchMode.value = !isBatchMode.value;
      if (!isBatchMode.value) selectedIds.value.clear();
      return;
    }
    if (matchesShortcut(e, getActiveShortcut('healthCheck'))) {
      e.preventDefault();
      isHealthModalOpen.value = true;
      return;
    }
    if (matchesShortcut(e, getActiveShortcut('openSettings'))) {
      e.preventDefault();
      isSettingsOpen.value = true;
      return;
    }
  }
}

onMounted(async () => {
  updateClock();
  clockTimer = setInterval(updateClock, 1000);

  initGlobalDragScroll();
  await loadSettings();
  await loadBookmarks();
  await loadColumnLayout(rawBookmarkTree.value);
  setupBookmarkListeners();

  window.addEventListener('keydown', handleGlobalKeyDown);
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
  window.removeEventListener('keydown', handleGlobalKeyDown);
});
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Compact Mode Corner Trigger & Slide-out Action Buttons -->
    <div
      v-if="userSettings.compactHeader"
      class="fixed top-0 right-0 z-50 flex items-start justify-end pointer-events-none"
    >
      <!-- Buttons that slide out to the left on hover or when batch/settings is active -->
      <div
        class="flex items-center gap-1.5 py-1 px-2.5 mt-1 mr-1.5 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-lg transition-all duration-200 ease-out"
        :class="[
          isCornerActive || isButtonsHovered || isBatchMode || isSettingsOpen
            ? 'opacity-100 translate-x-0 pointer-events-auto scale-100'
            : 'opacity-0 translate-x-4 pointer-events-none scale-95'
        ]"
        @mouseenter="handleButtonsEnter"
        @mouseleave="handleButtonsLeave"
      >
        <!-- Create Folder Button -->
        <button
          type="button"
          @click="openCreateFolder('2')"
          :title="t('header.newFolder')"
          class="p-1.5 rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center justify-center"
        >
          <FolderPlus class="w-3.5 h-3.5" />
        </button>

        <!-- Toggle Multi-select Batch Mode -->
        <button
          type="button"
          @click="isBatchMode = !isBatchMode; if (!isBatchMode) selectedIds.clear()"
          :class="[
            isBatchMode
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs',
          ]"
          :title="isBatchMode ? t('header.exitBatchManage') : t('header.batchManage')"
          class="p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center"
        >
          <CheckSquare class="w-3.5 h-3.5" />
        </button>

        <!-- Dead-link Health Check Button -->
        <button
          type="button"
          @click="isHealthModalOpen = true"
          :title="t('healthCheck.title') || '书签失效体检'"
          class="p-1.5 rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center justify-center"
        >
          <Activity class="w-3.5 h-3.5" />
        </button>

        <!-- Sponsor / Donate Button (Unified Monochrome) -->
        <button
          type="button"
          @click="openDonateSettings"
          :title="t('settings.tabDonate') || '赞赏支持'"
          class="p-1.5 rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
        >
          <Heart class="w-3.5 h-3.5 text-slate-800 dark:text-white" />
        </button>

        <!-- GitHub Repo Link Button -->
        <a
          href="https://github.com/noby338/ntab"
          target="_blank"
          rel="noopener noreferrer"
          title="GitHub - noby338/ntab"
          class="p-1.5 rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
        >
          <SearchEngineIcon engine-id="github" size-class="w-3.5 h-3.5" />
        </a>

        <!-- Settings Button -->
        <button
          type="button"
          @click="openGeneralSettings"
          :title="t('header.settings')"
          class="p-1.5 rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center justify-center"
        >
          <Settings class="w-3.5 h-3.5" />
        </button>

        <!-- Google User / Login Button in Compact Slide-out -->
        <button
          v-if="currentGoogleUser"
          type="button"
          @click="isSettingsOpen = true"
          :title="`${currentGoogleUser.name} (${currentGoogleUser.email})`"
          class="p-1 rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 shadow-2xs transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
        >
          <img
            v-if="currentGoogleUser.picture"
            :src="currentGoogleUser.picture"
            class="w-4 h-4 rounded-full object-cover"
            alt=""
          />
          <span v-else class="w-4 h-4 rounded-full bg-indigo-600 text-white font-bold text-[9px] flex items-center justify-center">
            {{ currentGoogleUser.name.charAt(0).toUpperCase() }}
          </span>
        </button>

        <button
          v-else
          type="button"
          @click="loginWithGoogle()"
          :title="t('auth.signInWithGoogle') || 'Google 账号登录'"
          class="p-1.5 rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
        >
          <SearchEngineIcon engine-id="google" size-class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Quarter-Circle Corner Indicator/Trigger -->
      <div
        class="w-6 h-6 rounded-bl-2xl bg-indigo-500/20 hover:bg-indigo-600 dark:bg-indigo-400/20 dark:hover:bg-indigo-500 border-b border-l border-indigo-500/40 transition-all duration-150 flex items-start justify-end p-0.5 cursor-pointer select-none group pointer-events-auto"
        :class="{ 'bg-indigo-600 dark:bg-indigo-500 shadow-xs': isCornerActive || isButtonsHovered || isBatchMode || isSettingsOpen }"
        :title="t('header.settings')"
        @mouseenter="handleCornerEnter"
        @mouseleave="handleCornerLeave"
        @click="isSettingsOpen = true"
      >
        <EyeOff
          class="w-3 h-3 transition-colors mr-0.5 mt-0.5"
          :class="isCornerActive || isButtonsHovered || isBatchMode || isSettingsOpen ? 'text-white' : 'text-indigo-600 dark:text-indigo-400 group-hover:text-white'"
        />
      </div>
    </div>

    <!-- Standard Top Header Bar (When Not in Compact Mode) -->
    <header
      v-if="!userSettings.compactHeader"
      class="flex items-center justify-between select-none z-30 transition-all duration-200 px-8 py-3.5"
    >
      <!-- Logo & Branding -->
      <div class="flex items-center gap-2">
        <img
          src="/wxt.svg"
          class="w-6 h-6 rounded-xl shadow-md flex-shrink-0"
          alt="NTab"
        />
        <span class="font-bold tracking-tight text-slate-900 dark:text-white leading-tight text-sm">
          NTab
        </span>
      </div>

      <!-- Optional Clock (Refined Size to Free Space) -->
      <div
        v-if="userSettings.showClock"
        class="flex flex-col items-center justify-center pointer-events-none"
      >
        <span class="font-extralight tracking-tight font-mono text-slate-900 dark:text-white drop-shadow-xs leading-none text-2xl md:text-3xl">
          {{ currentTime }}
        </span>
        <span class="text-[11px] font-medium text-slate-600 dark:text-zinc-300 mt-1">
          {{ currentDate }}
        </span>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
        <!-- Create Folder Button -->
        <button
          type="button"
          @click="openCreateFolder('2')"
          :title="t('header.newFolder')"
          class="rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center justify-center p-2"
        >
          <FolderPlus class="w-3.5 h-3.5" />
        </button>

        <!-- Toggle Multi-select Batch Mode -->
        <button
          type="button"
          @click="isBatchMode = !isBatchMode; if (!isBatchMode) selectedIds.clear()"
          :class="[
            isBatchMode
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs',
          ]"
          :title="isBatchMode ? t('header.exitBatchManage') : t('header.batchManage')"
          class="rounded-xl transition-all cursor-pointer flex items-center justify-center p-2"
        >
          <CheckSquare class="w-3.5 h-3.5" />
        </button>

        <!-- Dead-link Health Check Button -->
        <button
          type="button"
          @click="isHealthModalOpen = true"
          :title="t('healthCheck.title') || '书签失效体检'"
          class="rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center justify-center p-2"
        >
          <Activity class="w-3.5 h-3.5" />
        </button>

        <!-- Sponsor / Donate Button (Unified Monochrome) -->
        <button
          type="button"
          @click="openDonateSettings"
          :title="t('settings.tabDonate') || '赞赏支持'"
          class="rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center justify-center p-2 flex-shrink-0"
        >
          <Heart class="w-3.5 h-3.5 text-slate-800 dark:text-white" />
        </button>

        <!-- GitHub Repo Link Button -->
        <a
          href="https://github.com/noby338/ntab"
          target="_blank"
          rel="noopener noreferrer"
          title="GitHub - noby338/ntab"
          class="rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center justify-center p-2"
        >
          <SearchEngineIcon engine-id="github" size-class="w-3.5 h-3.5" />
        </a>

        <!-- Settings Button -->
        <button
          type="button"
          @click="openGeneralSettings"
          :title="t('header.settings')"
          class="rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center justify-center p-2"
        >
          <Settings class="w-3.5 h-3.5" />
        </button>

        <!-- Google User / Login Button in Standard Header -->
        <button
          v-if="currentGoogleUser"
          type="button"
          @click="isSettingsOpen = true"
          :title="`${currentGoogleUser.name} (${currentGoogleUser.email})`"
          class="rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-2 p-1.5 pr-2.5"
        >
          <img
            v-if="currentGoogleUser.picture"
            :src="currentGoogleUser.picture"
            class="w-5 h-5 rounded-full object-cover ring-1 ring-indigo-500/40"
            alt=""
          />
          <span v-else class="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
            {{ currentGoogleUser.name.charAt(0).toUpperCase() }}
          </span>
          <span class="text-xs font-medium max-w-[80px] truncate">
            {{ currentGoogleUser.name }}
          </span>
        </button>

        <button
          v-else
          type="button"
          @click="loginWithGoogle()"
          :title="t('auth.signInWithGoogle') || 'Google 账号登录'"
          class="rounded-xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-white dark:hover:bg-white/15 text-slate-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 py-1.5 px-2.5 text-xs font-semibold"
        >
          <SearchEngineIcon engine-id="google" size-class="w-3.5 h-3.5" />
          <span>{{ t('auth.signInWithGoogle') || 'Google 登录' }}</span>
        </button>
      </div>
    </header>

    <!-- Search Section (Higher up to save space) -->
    <section
      v-if="userSettings.showSearch"
      :class="userSettings.compactHeader ? 'px-6 pt-2 mb-2' : 'px-6 mb-3'"
    >
      <SearchBar />
    </section>

    <!-- Main Bookmark Columns Area -->
    <main
      class="flex-1 overflow-x-auto"
      :class="userSettings.compactHeader ? (userSettings.showSearch ? 'px-4 pb-8' : 'px-4 pt-3 pb-8') : 'px-8 pb-10'"
    >
      <div
        v-if="isLoaded"
        class="flex items-start transition-all relative min-h-[calc(100vh-180px)]"
        :class="{
          'justify-start': userSettings.columnAlign === 'left',
          'justify-center': userSettings.columnAlign === 'center',
          'justify-end': userSettings.columnAlign === 'right',
        }"
        :style="{ gap: `${userSettings.columnGap}px` }"
        @dragover="handleMainDragOver"
        @dragleave="handleMainDragLeave"
        @drop="handleMainDrop"
      >
        <BookmarkColumn
          v-for="(colFolderIds, colIdx) in displayedColumns"
          :key="colIdx"
          :col-index="colIdx"
          :folder-ids="colFolderIds"
          :is-batch-mode="isBatchMode"
          :selected-ids="selectedIds"
          :is-last-column="colIdx === displayedColumns.length - 1"
          @toggle-select="(id, e) => toggleSelect(id)"
          @delete-item="handleDeleteItem"
          @move-folder="handleMoveFolder"
          @open-context-menu="handleOpenContextMenu"
          @open-create-folder="openCreateFolder"
        />
      </div>

      <!-- Loading skeleton -->
      <div v-else class="flex gap-4">
        <div
          v-for="i in 3"
          :key="i"
          class="flex-1 min-w-[260px] h-96 rounded-2xl bg-slate-200/50 dark:bg-zinc-900/50 animate-pulse"
        ></div>
      </div>
    </main>

    <!-- Floating Batch Action Bar -->
    <BatchActionBar
      :is-visible="isBatchMode"
      :selected-count="selectedIds.size"
      @confirm-delete="handleBatchDelete"
      @clear-selection="clearSelection"
      @move-to-folder="handleBatchMove"
      @open-health-check="isHealthModalOpen = true"
    />

    <!-- Bookmark Health Check Modal -->
    <BookmarkHealthModal
      :is-open="isHealthModalOpen"
      :selected-bookmark-ids="selectedIds"
      @close="isHealthModalOpen = false"
    />

    <!-- Settings Modal -->
    <SettingsModal
      :is-open="isSettingsOpen"
      :initial-tab="settingsInitialTab"
      @close="isSettingsOpen = false"
    />

    <!-- Bookmark Context Menu -->
    <ContextMenu
      :is-open="contextMenuState.isOpen"
      :node="contextMenuState.node"
      :x="contextMenuState.x"
      :y="contextMenuState.y"
      @close="contextMenuState.isOpen = false"
      @delete-item="handleDeleteItem"
    />

    <!-- Create Folder Modal -->
    <CreateFolderModal
      :is-open="isCreateFolderOpen"
      :initial-parent-id="createFolderParentId"
      @close="isCreateFolderOpen = false"
    />

    <!-- Custom Unified Confirm Delete Modal -->
    <ConfirmDeleteModal
      :is-open="deleteModalState.isOpen"
      :title="deleteModalState.title"
      :description="deleteModalState.description"
      @confirm="handleConfirmDelete"
      @cancel="deleteModalState.isOpen = false"
    />
  </div>
</template>
