<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import {
  ExternalLink,
  CornerDownRight,
  Edit3,
  FolderInput,
  FolderPlus,
  EyeOff,
  Trash2,
  ChevronRight,
} from '@lucide/vue';
import type { BookmarkItem } from '../types';
import { folderMap, updateBookmark, moveBookmark, removeBookmark, isDescendantFolder } from '../services/bookmarks';
import { hideBookmark, hideFolder, addToColumnLayout, standaloneFolderIds } from '../services/storage';
import { t } from '../locales';

const props = defineProps<{
  node: BookmarkItem | null;
  x: number;
  y: number;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'deleteItem', id: string, isFolder: boolean): void;
}>();

const showMoveSubmenu = ref(false);
const showEditModal = ref(false);
const editTitle = ref('');
const editUrl = ref('');

const isFolder = computed(() => !!props.node?.children);
const isManaged = computed(() => props.node?.unmodifiable === 'managed');
const isStandaloneCard = computed(() => {
  return props.node ? standaloneFolderIds.value.has(props.node.id) : false;
});

const eligibleFolderTargets = computed(() => {
  if (!props.node) return [];
  const list: [string, BookmarkItem][] = [];
  for (const [id, folder] of folderMap.value) {
    if (id === '1' || id === '2') continue;
    if (id === props.node.id) continue;
    if (isFolder.value && isDescendantFolder(props.node.id, id)) continue;
    list.push([id, folder]);
  }
  return list;
});

function handleShowAsCard() {
  if (!props.node) return;
  addToColumnLayout(props.node.id, 0);
  emit('close');
}

const isNearRightEdge = computed(() => {
  if (typeof window === 'undefined') return false;
  return props.x > window.innerWidth - 380;
});

const menuStyle = computed(() => {
  const menuWidth = 190;
  const menuHeight = 240;
  const maxX = typeof window !== 'undefined' ? window.innerWidth - menuWidth - 12 : 500;
  const maxY = typeof window !== 'undefined' ? window.innerHeight - menuHeight - 12 : 500;

  const posX = Math.max(12, Math.min(props.x, maxX));
  const posY = Math.max(12, Math.min(props.y, maxY));

  return {
    left: `${posX}px`,
    top: `${posY}px`,
  };
});

function handleOpenNewTab() {
  if (props.node?.url) {
    window.open(props.node.url, '_blank', 'noopener,noreferrer');
  }
  emit('close');
}

function handleOpenCurrentTab() {
  if (props.node?.url) {
    window.location.href = props.node.url;
  }
  emit('close');
}

function handleStartEdit() {
  if (!props.node) return;
  editTitle.value = props.node.title || '';
  editUrl.value = props.node.url || '';
  showEditModal.value = true;
}

async function handleSaveEdit() {
  if (!props.node) return;
  await updateBookmark(props.node.id, {
    title: editTitle.value,
    url: isFolder.value ? undefined : editUrl.value,
  });
  showEditModal.value = false;
  emit('close');
}

async function handleMoveTo(targetFolderId: string) {
  if (!props.node) return;
  await moveBookmark(props.node.id, targetFolderId);
  showMoveSubmenu.value = false;
  emit('close');
}

function handleHide() {
  if (!props.node) return;
  if (isFolder.value) {
    hideFolder(props.node.id);
  } else {
    hideBookmark(props.node.id);
  }
  emit('close');
}

function handleDelete() {
  if (!props.node) return;
  emit('deleteItem', props.node.id, isFolder.value);
  emit('close');
}

function handleWindowClick(e: MouseEvent) {
  if (props.isOpen && !showEditModal.value) {
    emit('close');
  }
}

function handleWindowKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showEditModal.value) {
      showEditModal.value = false;
    } else if (props.isOpen) {
      emit('close');
    }
  }
}

onMounted(() => {
  window.addEventListener('click', handleWindowClick);
  window.addEventListener('keydown', handleWindowKey);
});

onUnmounted(() => {
  window.removeEventListener('click', handleWindowClick);
  window.removeEventListener('keydown', handleWindowKey);
});
</script>

<template>
  <div v-if="isOpen && node">
    <div
      class="fixed z-50 w-52 theme-popover backdrop-blur-xl rounded-2xl p-1.5 text-xs select-none shadow-2xl animate-in fade-in zoom-in-95 duration-100"
      :style="menuStyle"
      @click.stop
    >
      <div v-if="!isFolder && node.url" class="space-y-0.5">
        <button
          type="button"
          @click="handleOpenNewTab"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg theme-popover-item hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left cursor-pointer"
        >
          <ExternalLink class="w-3.5 h-3.5 text-indigo-500" />
          <span>{{ t('contextMenu.openInNewTab') }}</span>
        </button>

        <button
          type="button"
          @click="handleOpenCurrentTab"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg theme-popover-item hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left cursor-pointer"
        >
          <CornerDownRight class="w-3.5 h-3.5 text-slate-400" />
          <span>{{ t('contextMenu.openInCurrentTab') }}</span>
        </button>

        <div class="h-px bg-black/5 dark:bg-white/5 my-1"></div>
      </div>

      <button
        v-if="!isManaged"
        type="button"
        @click="handleStartEdit"
        class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg theme-popover-item transition-colors text-left cursor-pointer"
      >
        <Edit3 class="w-3.5 h-3.5 text-slate-400" />
        <span>{{ isFolder ? t('contextMenu.editFolder') : t('contextMenu.editBookmark') }}</span>
      </button>

      <button
        v-if="isFolder && !isManaged && !isStandaloneCard"
        type="button"
        @click="handleShowAsCard"
        class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg theme-popover-item text-indigo-600 dark:text-indigo-400 transition-colors text-left cursor-pointer"
      >
        <FolderPlus class="w-3.5 h-3.5" />
        <span>{{ t('contextMenu.showAsCard') }}</span>
      </button>

      <div v-if="!isManaged" class="relative">
        <button
          type="button"
          @click="showMoveSubmenu = !showMoveSubmenu"
          class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg theme-popover-item transition-colors text-left cursor-pointer"
        >
          <div class="flex items-center gap-2">
            <FolderInput class="w-3.5 h-3.5 text-slate-400" />
            <span>{{ t('contextMenu.moveToFolder') }}</span>
          </div>
          <ChevronRight class="w-3 h-3 text-slate-400" />
        </button>

        <div
          v-if="showMoveSubmenu"
          class="absolute top-0 w-56 max-h-60 overflow-y-auto theme-popover backdrop-blur-xl rounded-xl shadow-xl p-1 z-50 text-xs"
          :class="isNearRightEdge ? 'right-full mr-1.5' : 'left-full ml-1.5'"
        >
          <div class="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase">{{ t('createFolder.parentLabel') }}</div>

          <button
            type="button"
            @click="handleMoveTo('1')"
            class="w-full flex items-center justify-between px-2 py-1.5 rounded-lg theme-popover-item text-amber-600 dark:text-amber-400 transition-colors text-left truncate cursor-pointer font-medium"
          >
            <span class="flex items-center gap-1.5 truncate">
              <span>🗂️</span>
              <span class="truncate">{{ t('createFolder.bookmarksBar') }}</span>
            </span>
            <span class="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex-shrink-0">
              {{ t('contextMenu.rootLevel') || '最外层' }}
            </span>
          </button>

          <button
            type="button"
            @click="handleMoveTo('2')"
            class="w-full flex items-center justify-between px-2 py-1.5 rounded-lg theme-popover-item text-cyan-600 dark:text-cyan-400 transition-colors text-left truncate cursor-pointer font-medium"
          >
            <span class="flex items-center gap-1.5 truncate">
              <span>📁</span>
              <span class="truncate">{{ t('createFolder.otherBookmarks') }}</span>
            </span>
            <span class="text-[9px] px-1 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex-shrink-0">
              {{ t('contextMenu.rootLevel') || '最外层' }}
            </span>
          </button>

          <div v-if="eligibleFolderTargets.length > 0" class="h-px bg-black/5 dark:bg-white/5 my-1"></div>

          <button
            v-for="[id, folder] in eligibleFolderTargets"
            :key="id"
            type="button"
            @click="handleMoveTo(id)"
            class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg theme-popover-item hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left truncate cursor-pointer"
          >
            <span>📁</span>
            <span class="truncate">{{ folder.title || t('common.unnamed') }}</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        @click="handleHide"
        class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg theme-popover-item text-amber-600 dark:text-amber-400 transition-colors text-left cursor-pointer"
      >
        <EyeOff class="w-3.5 h-3.5" />
        <span>{{ t('contextMenu.hideItem') }}</span>
      </button>

      <div v-if="!isManaged" class="h-px bg-black/5 dark:bg-white/5 my-1"></div>

      <button
        v-if="!isManaged"
        type="button"
        @click="handleDelete"
        class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors text-left cursor-pointer"
      >
        <Trash2 class="w-3.5 h-3.5" />
        <span>{{ t('common.delete') }}</span>
      </button>
    </div>

    <!-- Edit Dialog Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      @click.stop
    >
      <div
        class="w-full max-w-sm theme-popover rounded-3xl p-6 text-xs select-none shadow-2xl"
        style="font-size: 14px;"
      >
        <h4 class="text-sm font-semibold mb-4 text-slate-900 dark:text-zinc-100">
          {{ isFolder ? t('contextMenu.editFolder') : t('contextMenu.editBookmark') }}
        </h4>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">{{ t('contextMenu.title') }}</label>
            <input
              v-model="editTitle"
              type="text"
              class="w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style="background-color: var(--item-hover); border: 1px solid var(--card-border); color: var(--text-main);"
            />
          </div>

          <div v-if="!isFolder">
            <label class="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">{{ t('contextMenu.url') }}</label>
            <input
              v-model="editUrl"
              type="url"
              class="w-full px-3 py-2 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style="background-color: var(--item-hover); border: 1px solid var(--card-border); color: var(--text-main);"
            />
          </div>
        </div>

        <div class="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            @click="showEditModal = false; emit('close')"
            class="px-3.5 py-1.5 rounded-xl text-xs text-slate-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            @click="handleSaveEdit"
            class="px-3.5 py-1.5 rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors cursor-pointer"
          >
            {{ t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
