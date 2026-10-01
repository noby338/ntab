<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  GripVertical,
  Folder,
  History,
  TrendingUp,
  ChevronRight,
  MoreVertical,
  Trash2,
  EyeOff,
  FolderPlus,
  AppWindow,
  Edit3,
  Check,
  RotateCcw,
  Globe,
} from '@lucide/vue';
import type { BookmarkItem } from '../types';
import BookmarkNode from './BookmarkNode.vue';
import { folderMap, topSitesList, recentlyClosedList, moveBookmark, removeBookmark, updateBookmark, getFaviconUrl } from '../services/bookmarks';
import { recentlyDeletedList, restoreBookmark, permanentlyDelete, clearRecentlyDeleted } from '../services/recentlyDeleted';
import {
  collapsedFolders,
  toggleFolderCollapse,
  removeFromColumnLayout,
  addToColumnLayout,
  setSpecialWidgetVisible,
  activeFolderMenuId,
  hideFolder,
} from '../services/storage';
import {
  isGlobalDragging,
  globalDragType,
  activeDragItem,
  startGlobalDrag,
  endGlobalDrag,
} from '../services/dragScroll';
import {
  activeDropTarget,
  startCardDrag,
  endCardDrag,
} from '../services/cardDragCoordinator';
import { t } from '../locales';

const props = defineProps<{
  folderId: string;
  colIndex: number;
  rowIndex: number;
  isBatchMode: boolean;
  selectedIds: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'toggleSelect', id: string, event: MouseEvent): void;
  (e: 'deleteItem', id: string, isFolder: boolean): void;
  (e: 'openContextMenu', payload: { node: BookmarkItem; x: number; y: number }): void;
  (e: 'openCreateFolder', parentId: string): void;
  (e: 'columnDropChange', pos: 'left' | 'right' | null): void;
  (
    e: 'moveFolder',
    payload: {
      fromCol: number;
      fromRow: number;
      toCol: number;
      toRow: number;
      direction: 'before' | 'after' | 'left' | 'right';
    }
  ): void;
}>();

const CHROME_APPS_LIST: BookmarkItem[] = [
  { id: 'app-apps', title: 'Chrome 应用 (Apps)', url: 'chrome://apps', isSpecial: true },
  { id: 'app-extensions', title: '扩展程序管理 (Extensions)', url: 'chrome://extensions', isSpecial: true },
  { id: 'app-bookmarks', title: '书签管理器 (Bookmarks)', url: 'chrome://bookmarks', isSpecial: true },
  { id: 'app-history', title: '浏览历史记录 (History)', url: 'chrome://history', isSpecial: true },
  { id: 'app-downloads', title: '下载内容 (Downloads)', url: 'chrome://downloads', isSpecial: true },
  { id: 'app-webstore', title: 'Chrome 网上应用店', url: 'https://chromewebstore.google.com', isSpecial: true },
];

function formatRelativeTime(timestamp: number): string {
  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('common.justNow') || '刚刚';
  if (minutes < 60) return (t('common.minutesAgo') || '{m}分钟前').replace('{m}', String(minutes));
  if (hours < 24) return (t('common.hoursAgo') || '{h}小时前').replace('{h}', String(hours));
  return (t('common.daysAgo') || '{d}天前').replace('{d}', String(days));
}

function getHostname(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const isMenuOpen = computed(() => activeFolderMenuId.value === props.folderId);
const isSpecial = computed(() => props.folderId === 'top_sites' || props.folderId === 'recently_closed' || props.folderId === 'apps' || props.folderId === 'recently_deleted');
const isDeletable = computed(() => !isSpecial.value && props.folderId !== '1' && props.folderId !== '2');

const isRenaming = ref(false);
const renameInputRef = ref<HTMLInputElement | null>(null);
const renameTitle = ref('');

function startRenameFolder() {
  activeFolderMenuId.value = null;
  if (!folderData.value || isSpecial.value) return;
  renameTitle.value = folderData.value.title || '';
  isRenaming.value = true;
  nextTick(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  });
}

async function saveRenameFolder() {
  if (!isRenaming.value) return;
  const newTitle = renameTitle.value.trim();
  if (newTitle && folderData.value && newTitle !== folderData.value.title) {
    await updateBookmark(props.folderId, { title: newTitle });
  }
  isRenaming.value = false;
}

function cancelRenameFolder() {
  isRenaming.value = false;
  renameTitle.value = '';
}

const isMenuNearBottom = ref(false);

function toggleMenu(event: MouseEvent) {
  event.stopPropagation();
  if (activeFolderMenuId.value === props.folderId) {
    activeFolderMenuId.value = null;
  } else {
    const triggerEl = event.currentTarget as HTMLElement | null;
    if (triggerEl && typeof window !== 'undefined') {
      const rect = triggerEl.getBoundingClientRect();
      isMenuNearBottom.value = (window.innerHeight - rect.bottom) < 230;
    } else {
      isMenuNearBottom.value = false;
    }
    activeFolderMenuId.value = props.folderId;
  }
}

function handleDeleteFolder() {
  activeFolderMenuId.value = null;
  emit('deleteItem', props.folderId, true);
}

function handleRemoveCard() {
  activeFolderMenuId.value = null;
  hideFolder(props.folderId);
}

function handleHideSpecial() {
  activeFolderMenuId.value = null;
  if (props.folderId === 'top_sites') {
    setSpecialWidgetVisible('top_sites', false);
  } else if (props.folderId === 'recently_closed') {
    setSpecialWidgetVisible('recently_closed', false);
  } else if (props.folderId === 'apps') {
    setSpecialWidgetVisible('apps', false);
  } else if (props.folderId === 'recently_deleted') {
    setSpecialWidgetVisible('recently_deleted', false);
  }
}

const folderData = computed<BookmarkItem | null>(() => {
  if (props.folderId === 'recently_deleted') {
    return {
      id: 'recently_deleted',
      title: t('card.specialRecentlyDeleted') || '最近删除 (7天)',
      children: [],
      isSpecial: true,
      unmodifiable: 'managed',
    };
  }
  if (props.folderId === 'apps') {
    return {
      id: 'apps',
      title: t('card.specialApps'),
      children: CHROME_APPS_LIST,
      isSpecial: true,
      unmodifiable: 'managed',
    };
  }
  if (props.folderId === 'top_sites') {
    return {
      id: 'top_sites',
      title: t('card.specialTopSites'),
      children: topSitesList.value,
      isSpecial: true,
      unmodifiable: 'managed',
    };
  }
  if (props.folderId === 'recently_closed') {
    return {
      id: 'recently_closed',
      title: t('card.specialRecentlyClosed'),
      children: recentlyClosedList.value,
      isSpecial: true,
      unmodifiable: 'managed',
    };
  }
  return folderMap.value.get(props.folderId) || null;
});

const isCollapsed = computed(() => collapsedFolders.value.has(props.folderId));

const cardTypeMeta = computed<{
  type: string;
  badge: string | null;
  iconColor: string;
  badgeClass: string;
}>(() => {
  if (props.folderId === '1') {
    return {
      type: 'bookmarks-bar',
      badge: t('card.badgeBookmarksBar'),
      iconColor: 'text-amber-500 dark:text-amber-400',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    };
  }
  if (props.folderId === '2') {
    return {
      type: 'other-bookmarks',
      badge: t('card.badgeOtherBookmarks'),
      iconColor: 'text-cyan-500 dark:text-cyan-400',
      badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    };
  }
  if (props.folderId === 'top_sites') {
    return {
      type: 'top-sites',
      badge: t('card.badgeTopSites'),
      iconColor: 'text-emerald-500',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    };
  }
  if (props.folderId === 'recently_closed') {
    return {
      type: 'recently-closed',
      badge: t('card.badgeRecentlyClosed'),
      iconColor: 'text-sky-500',
      badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    };
  }
  if (props.folderId === 'apps') {
    return {
      type: 'apps',
      badge: t('card.badgeApps'),
      iconColor: 'text-violet-500',
      badgeClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    };
  }
  if (props.folderId === 'recently_deleted') {
    return {
      type: 'recently-deleted',
      badge: null,
      iconColor: 'text-rose-500',
      badgeClass: '',
    };
  }
  return {
    type: 'custom',
    badge: null,
    iconColor: 'text-indigo-500 dark:text-indigo-400',
    badgeClass: '',
  };
});

const isDraggingFolder = ref(false);
const isDragOverFolder = ref(false);
const folderDropPos = ref<'before' | 'after' | 'left' | 'right' | 'inside' | null>(null);

watch(isGlobalDragging, (dragging) => {
  if (!dragging) {
    isDraggingFolder.value = false;
    isDragOverFolder.value = false;
    folderDropPos.value = null;
  }
});

function handleFolderDragStart(event: DragEvent) {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(
    'application/json',
    JSON.stringify({
      type: 'folder_card',
      folderId: props.folderId,
      fromCol: props.colIndex,
      fromRow: props.rowIndex,
    })
  );
  startGlobalDrag({
    type: 'folder_card',
    id: props.folderId,
    fromCol: props.colIndex,
    fromRow: props.rowIndex,
  });
  startCardDrag({
    id: props.folderId,
    fromCol: props.colIndex,
    fromRow: props.rowIndex,
  });
  isDraggingFolder.value = true;
}

function handleFolderDragEnd() {
  isDraggingFolder.value = false;
  isDragOverFolder.value = false;
  folderDropPos.value = null;
  endCardDrag();
  endGlobalDrag();
}

function handleFolderDragOver(event: DragEvent) {
  if (globalDragType.value === 'bookmark') {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer) return;
    event.dataTransfer.dropEffect = 'move';
    if (!isSpecial.value) {
      folderDropPos.value = 'inside';
      isDragOverFolder.value = true;
    }
  }
}

function handleFolderDragLeave(event: DragEvent) {
  if (globalDragType.value === 'bookmark') {
    const current = event.currentTarget as HTMLElement | null;
    const related = event.relatedTarget as HTMLElement | null;
    if (current && related && current.contains(related)) return;
    isDragOverFolder.value = false;
    folderDropPos.value = null;
  }
}

async function handleFolderDrop(event: DragEvent) {
  if (globalDragType.value === 'bookmark') {
    event.preventDefault();
    event.stopPropagation();
    isDragOverFolder.value = false;
    folderDropPos.value = null;
    endGlobalDrag();

    const raw = event.dataTransfer?.getData('application/json');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.type === 'bookmark' && !isSpecial.value) {
        await moveBookmark(data.id, props.folderId, undefined, { title: data.title, url: data.url });
      }
    } catch (e) {
      console.error('[NTab] Error dropping bookmark into folder:', e);
    }
  }
}
</script>

<template>
  <div
    v-if="folderData"
    :data-card-id="folderId"
    :data-row-index="rowIndex"
    class="relative group/folder backdrop-blur-xl border rounded-2xl shadow-sm transition-[background-color,border-color,opacity,box-shadow] duration-150 flex-shrink-0"
    style="background-color: var(--card-bg); border-color: var(--card-border);"
    :class="[
      isDraggingFolder ? 'opacity-40 scale-98' : '',
      isMenuOpen ? 'z-40' : 'z-0'
    ]"
    @dragover="handleFolderDragOver"
    @dragleave="handleFolderDragLeave"
    @drop="handleFolderDrop"
  >
    <!-- Horizontal Card Slot Indicator: Above this card -->
    <div
      v-if="activeDropTarget?.type === 'card_slot' && activeDropTarget.colIndex === colIndex && activeDropTarget.slotIndex === rowIndex"
      class="absolute -top-2 left-2 right-2 h-1.5 bg-indigo-500 rounded-full z-40 shadow-lg shadow-indigo-500/40 pointer-events-none transition-all duration-100 animate-in fade-in"
    >
      <div class="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-zinc-900 shadow-md"></div>
      <div class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-zinc-900 shadow-md"></div>
    </div>

    <!-- Folder Nesting Highlight -->
    <div
      v-if="(activeDropTarget?.type === 'folder_nest' && activeDropTarget.folderId === folderId) || (isDragOverFolder && folderDropPos === 'inside')"
      class="absolute inset-0 border-2 border-indigo-500 rounded-2xl bg-indigo-500/15 z-30 pointer-events-none flex items-center justify-center animate-in fade-in duration-150 shadow-inner"
    >
      <span class="px-3.5 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30">
        {{ t('card.moveIntoFolder') }}
      </span>
    </div>

    <!-- Header -->
    <div
      class="flex items-center border-b border-black/5 dark:border-white/5 select-none"
      :style="{
        paddingTop: 'clamp(5px, calc(var(--bookmark-row-height, 32px) * 0.25), 12px)',
        paddingBottom: 'clamp(5px, calc(var(--bookmark-row-height, 32px) * 0.25), 12px)',
        paddingLeft: 'clamp(8px, calc(var(--bookmark-row-height, 32px) * 0.35), 14px)',
        paddingRight: 'clamp(8px, calc(var(--bookmark-row-height, 32px) * 0.35), 14px)',
        gap: 'clamp(4px, calc(var(--bookmark-row-height, 32px) * 0.22), 10px)',
      }"
    >
      <div
        draggable="true"
        @dragstart="handleFolderDragStart"
        @dragend="handleFolderDragEnd"
        :title="t('card.dragTooltip')"
        class="cursor-grab active:cursor-grabbing p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:text-zinc-500 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
      >
        <GripVertical class="w-4 h-4" />
      </div>

      <div class="flex-shrink-0">
        <TrendingUp
          v-if="folderId === 'top_sites'"
          class="w-4 h-4 text-emerald-500"
        />
        <History
          v-else-if="folderId === 'recently_closed'"
          class="w-4 h-4 text-sky-500"
        />
        <AppWindow
          v-else-if="folderId === 'apps'"
          class="w-4 h-4 text-violet-500"
        />
        <Trash2
          v-else-if="folderId === 'recently_deleted'"
          class="w-4 h-4 text-rose-500"
        />
        <Folder v-else class="w-4 h-4" :class="cardTypeMeta.iconColor" />
      </div>

      <div
        v-if="!isRenaming"
        @click="toggleFolderCollapse(folderId)"
        @dblclick.stop="isDeletable && startRenameFolder()"
        :title="isDeletable ? `${folderData.title} (${t('card.doubleClickToRename') || '双击重命名'})` : folderData.title"
        class="flex-1 min-w-0 font-semibold text-slate-900 dark:text-zinc-50 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors leading-tight"
        :style="{
          fontSize: 'clamp(12px, calc(var(--bookmark-font-size, 14px) + 0.5px), 15px)',
        }"
      >
        {{ folderData.title }}
      </div>

      <div v-else class="flex-1 min-w-0 mr-1 flex items-center gap-1" @click.stop>
        <input
          ref="renameInputRef"
          v-model="renameTitle"
          type="text"
          class="w-full px-2 py-0.5 rounded-lg border border-indigo-500 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          :style="{
            fontSize: 'clamp(12px, calc(var(--bookmark-font-size, 14px) + 0.5px), 15px)',
          }"
          @keydown.enter.prevent="saveRenameFolder"
          @keydown.esc.prevent="cancelRenameFolder"
          @blur="saveRenameFolder"
        />
        <button
          type="button"
          @mousedown.prevent="saveRenameFolder"
          class="p-0.5 rounded hover:bg-emerald-500/10 text-emerald-600 cursor-pointer flex-shrink-0"
          :title="t('common.save')"
        >
          <Check class="w-3.5 h-3.5" />
        </button>
      </div>

      <span
        v-if="!isRenaming && cardTypeMeta.badge"
        class="text-[10px] font-medium px-1.5 py-0.5 rounded-md border flex-shrink-0 select-none leading-none"
        :class="cardTypeMeta.badgeClass"
      >
        {{ cardTypeMeta.badge }}
      </span>

      <span
        v-if="!isRenaming && (folderId === 'recently_deleted' || folderData.children)"
        class="font-mono font-semibold rounded-full bg-slate-200/80 dark:bg-white/10 text-slate-800 dark:text-zinc-200 leading-none flex items-center justify-center flex-shrink-0"
        :style="{
          fontSize: 'clamp(9px, calc(var(--bookmark-font-size, 14px) * 0.78), 12px)',
          height: 'clamp(14px, calc(var(--bookmark-row-height, 32px) - 10px), 20px)',
          paddingLeft: 'clamp(4px, calc(var(--bookmark-row-height, 32px) * 0.2), 8px)',
          paddingRight: 'clamp(4px, calc(var(--bookmark-row-height, 32px) * 0.2), 8px)',
        }"
      >
        {{ folderId === 'recently_deleted' ? recentlyDeletedList.length : (folderData.children ? folderData.children.length : 0) }}
      </span>

      <button
        v-if="!isRenaming"
        type="button"
        @click="toggleFolderCollapse(folderId)"
        class="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
      >
        <ChevronRight
          class="w-3.5 h-3.5 transition-transform duration-200"
          :class="{ 'rotate-90': !isCollapsed }"
        />
      </button>

      <!-- Actions Menu Trigger -->
      <div class="relative z-50">
        <button
          type="button"
          @click.stop="toggleMenu"
          class="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
          :title="t('card.moreOptions')"
        >
          <MoreVertical class="w-3.5 h-3.5" />
        </button>

        <!-- Dropdown Menu -->
        <div
          v-if="isMenuOpen"
          class="absolute right-0 w-52 theme-popover backdrop-blur-xl rounded-2xl p-1.5 z-50 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          :class="isMenuNearBottom ? 'bottom-full mb-1.5' : 'top-full mt-1.5'"
          @click.stop
        >
          <button
            v-if="!isSpecial"
            type="button"
            @click="activeFolderMenuId = null; emit('openCreateFolder', folderId)"
            class="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl theme-popover-item transition-colors text-left cursor-pointer"
          >
            <FolderPlus class="w-3.5 h-3.5 text-indigo-500" />
            <span>{{ t('card.newSubfolder') }}</span>
          </button>

          <!-- Rename Folder Button -->
          <button
            v-if="isDeletable"
            type="button"
            @click="startRenameFolder"
            class="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl theme-popover-item transition-colors text-left cursor-pointer"
          >
            <Edit3 class="w-3.5 h-3.5 text-slate-400" />
            <span>{{ t('card.renameFolder') || '重命名文件夹' }}</span>
          </button>

          <button
            v-if="!isSpecial && folderId !== '1' && folderId !== '2'"
            type="button"
            @click="handleRemoveCard"
            class="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl theme-popover-item transition-colors text-left cursor-pointer"
          >
            <EyeOff class="w-3.5 h-3.5 text-slate-400" />
            <span>{{ t('card.removeFromColumns') }}</span>
          </button>

          <button
            v-if="folderId === 'recently_deleted' && recentlyDeletedList.length > 0"
            type="button"
            @click="clearRecentlyDeleted(); activeFolderMenuId = null"
            class="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors text-left cursor-pointer"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>{{ t('card.clearTrash') || '清空回收站' }}</span>
          </button>

          <button
            v-if="isSpecial"
            type="button"
            @click="handleHideSpecial"
            class="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl theme-popover-item text-amber-600 dark:text-amber-400 transition-colors text-left cursor-pointer"
          >
            <EyeOff class="w-3.5 h-3.5" />
            <span>{{ t('card.hideWidget') }}</span>
          </button>

          <button
            v-if="isDeletable"
            type="button"
            @click="handleDeleteFolder"
            class="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors text-left cursor-pointer"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>{{ t('card.permanentDelete') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Bookmarks List -->
    <div
      v-show="!isCollapsed"
      class="flex flex-col"
      :style="{
        padding: 'clamp(3px, calc(var(--bookmark-row-height, 32px) * 0.16), 8px)',
        gap: 'clamp(0px, calc(var(--bookmark-row-height, 32px) * 0.06 - 0.5px), 2px)',
        minHeight: 'clamp(16px, var(--bookmark-row-height, 32px), 30px)',
      }"
    >
      <!-- Special Case: Recently Deleted (7-day trash) -->
      <template v-if="folderId === 'recently_deleted'">
        <div v-if="recentlyDeletedList.length > 0" class="flex flex-col">
          <div
            v-for="item in recentlyDeletedList"
            :key="item.id"
            class="group/trash relative flex items-center rounded-lg cursor-pointer transition-colors overflow-hidden select-none hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-900 dark:text-zinc-100"
            :style="{
              fontSize: 'var(--bookmark-font-size, 14px)',
              height: 'var(--bookmark-row-height, 32px)',
              minHeight: 'var(--bookmark-row-height, 32px)',
              transitionDuration: 'var(--hover-duration, 75ms)',
              paddingLeft: 'clamp(4px, calc(var(--bookmark-row-height, 32px) * 0.22), 10px)',
              paddingRight: 'clamp(4px, calc(var(--bookmark-row-height, 32px) * 0.22), 10px)',
              gap: 'clamp(4px, calc(var(--bookmark-row-height, 32px) * 0.22), 10px)',
            }"
            :title="`${item.title}${item.url ? '\n' + item.url : ''}\n${formatRelativeTime(item.deletedAt)}`"
          >
            <!-- Logo Icon Box -->
            <div
              class="flex-shrink-0 rounded-md bg-slate-100 dark:bg-white/10 flex items-center justify-center shadow-2xs overflow-hidden"
              :style="{
                width: 'clamp(12px, calc(var(--bookmark-row-height, 32px) - 6px), 20px)',
                height: 'clamp(12px, calc(var(--bookmark-row-height, 32px) - 6px), 20px)',
                padding: 'clamp(1px, calc(var(--bookmark-row-height, 32px) * 0.05), 2px)',
              }"
            >
              <Folder v-if="item.isFolder" class="w-full h-full max-w-full max-h-full object-contain text-amber-500" />
              <img
                v-else-if="item.url"
                :src="getFaviconUrl(item.url)"
                class="w-full h-full max-w-full max-h-full rounded-xs object-contain"
                loading="lazy"
                alt=""
                @error="($event.target as HTMLElement).style.display = 'none'"
              />
              <Globe v-else class="w-full h-full max-w-full max-h-full object-contain text-slate-400" />
            </div>

            <!-- Title -->
            <span class="truncate flex-1 min-w-0 leading-none">
              {{ item.title }}
            </span>

            <!-- Passive Relative Time -->
            <span
              class="text-[11px] text-slate-400 dark:text-zinc-500 font-mono truncate flex-shrink-0 opacity-75 group-hover/trash:hidden leading-none"
            >
              {{ formatRelativeTime(item.deletedAt) }}
            </span>

            <!-- Hover Action Buttons -->
            <div class="hidden group-hover/trash:flex items-center gap-0.5 flex-shrink-0">
              <button
                type="button"
                @click.stop="restoreBookmark(item.id)"
                :title="t('card.restoreBookmark') || '恢复书签'"
                class="p-1 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 cursor-pointer transition-colors"
              >
                <RotateCcw class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                @click.stop="permanentlyDelete(item.id)"
                :title="t('card.permanentDelete') || '彻底删除'"
                class="p-1 rounded-md text-rose-500 hover:bg-rose-500/15 cursor-pointer transition-colors"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div
          v-else
          class="py-6 px-4 text-center text-xs text-slate-500 dark:text-zinc-400 select-none flex flex-col items-center justify-center gap-1.5"
        >
          <Trash2 class="w-5 h-5 text-slate-300 dark:text-zinc-600 opacity-60" />
          <span>{{ t('card.emptyRecentlyDeleted') || '7天内没有删除任何书签' }}</span>
        </div>
      </template>

      <!-- Standard Bookmark Folder Content -->
      <template v-else-if="folderData.children && folderData.children.length > 0">
        <BookmarkNode
          v-for="(item, idx) in folderData.children"
          :key="item.id"
          :node="item"
          :item-index="idx"
          :parent-folder-id="folderData.id"
          :level="0"
          :is-batch-mode="isBatchMode"
          :selected-ids="selectedIds"
          @toggle-select="(id, e) => emit('toggleSelect', id, e)"
          @delete-item="(id, isF) => emit('deleteItem', id, isF)"
          @open-context-menu="(payload) => emit('openContextMenu', payload)"
        />
      </template>

      <div
        v-else
        class="py-6 px-4 text-center text-xs text-slate-500 dark:text-zinc-400 select-none flex flex-col items-center justify-center gap-1.5"
      >
        <template v-if="folderId === 'recently_closed'">
          <History class="w-5 h-5 text-slate-300 dark:text-zinc-600 opacity-60" />
          <span>{{ t('card.emptyRecentlyClosed') || '暂无最近关闭的标签页' }}</span>
        </template>
        <template v-else-if="folderId === 'top_sites'">
          <TrendingUp class="w-5 h-5 text-slate-300 dark:text-zinc-600 opacity-60" />
          <span>{{ t('card.emptyTopSites') || '暂无常访网站数据' }}</span>
        </template>
        <template v-else-if="folderId === 'apps'">
          <AppWindow class="w-5 h-5 text-slate-300 dark:text-zinc-600 opacity-60" />
          <span>{{ t('card.emptyApps') || '暂无应用快捷方式' }}</span>
        </template>
        <template v-else>
          <Folder class="w-5 h-5 text-slate-300 dark:text-zinc-600 opacity-60" />
          <span>{{ t('common.emptyFolderDropHint') }}</span>
        </template>
      </div>
    </div>
  </div>
</template>
