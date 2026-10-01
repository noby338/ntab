<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  Folder,
  FolderOpen,
  Globe,
  Trash2,
  ChevronRight,
} from '@lucide/vue';
import type { BookmarkItem } from '../types';
import { getFaviconUrl, moveBookmark, openUrl } from '../services/bookmarks';
import {
  userSettings,
  collapsedFolders,
  toggleFolderCollapse,
  removeFromColumnLayout,
  standaloneFolderIds,
} from '../services/storage';
import {
  isGlobalDragging,
  globalDragType,
  activeDragItem,
  startGlobalDrag,
  endGlobalDrag,
} from '../services/dragScroll';
import { startCardDrag, endCardDrag } from '../services/cardDragCoordinator';
import {
  isBatchPointerSelecting,
  batchTargetSelectState,
  startBatchSelect,
  endBatchSelect,
  triggerSelectId,
} from '../services/batchSelectionCoordinator';
import { t } from '../locales';

const props = defineProps<{
  node: BookmarkItem;
  itemIndex?: number;
  parentFolderId?: string;
  level?: number;
  isBatchMode: boolean;
  selectedIds: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'toggleSelect', id: string, event: MouseEvent): void;
  (e: 'deleteItem', id: string, isFolder: boolean): void;
  (e: 'openContextMenu', payload: { node: BookmarkItem; x: number; y: number }): void;
}>();

const isSelected = computed(() => props.selectedIds?.has(props.node.id));

const isHidden = computed(() => {
  return (
    userSettings.value.hiddenBookmarkIds?.includes(props.node.id) ||
    (isFolder.value && userSettings.value.hiddenFolderIds?.includes(props.node.id))
  );
});

const isStandaloneCard = computed(() => {
  return isFolder.value && standaloneFolderIds.value.has(props.node.id);
});

function handleContextMenu(event: MouseEvent) {
  emit('openContextMenu', {
    node: props.node,
    x: event.clientX,
    y: event.clientY,
  });
}

const isFolder = computed(() => Array.isArray(props.node.children));
const isCollapsed = computed(() => isFolder.value && collapsedFolders.value.has(props.node.id));
const hasFaviconError = ref(false);

const shouldOmitLogo = computed(() => {
  return !isFolder.value && Boolean(userSettings.value.hideBookmarkIcons);
});

const folderColorClass = computed(() => {
  if (props.node.id === '1') return 'text-amber-500 dark:text-amber-400';
  if (props.node.id === '2') return 'text-cyan-500 dark:text-cyan-400';
  return 'text-indigo-500 dark:text-indigo-400';
});

const faviconSrc = computed(() => {
  if (isFolder.value || !props.node.url) return '';
  return getFaviconUrl(props.node.url);
});

const domain = computed(() => {
  if (!props.node.url) return '';
  try {
    return new URL(props.node.url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
});

const displayTitle = computed(() => {
  const text = props.node.title?.trim();
  if (text) return text;
  if (domain.value) return domain.value;
  return props.node.url || t('common.unnamed');
});

const isDragOver = ref(false);
const dropPosition = ref<'inside' | 'before' | 'after' | null>(null);

watch(isGlobalDragging, (dragging) => {
  if (!dragging) {
    isDragOver.value = false;
    dropPosition.value = null;
  }
});

function handleRowPointerDown(event: PointerEvent) {
  if (!props.isBatchMode || event.button !== 0) return;
  const willSelect = !isSelected.value;
  startBatchSelect(willSelect, event.clientX, event.clientY);
  triggerSelectId(props.node.id, willSelect);
}

function handleRowPointerEnter(event: PointerEvent) {
  if (!props.isBatchMode || !isBatchPointerSelecting.value) return;
  if (event.buttons !== 1) {
    endBatchSelect();
    return;
  }
  triggerSelectId(props.node.id, batchTargetSelectState.value);
}

function handleRowClick(event: MouseEvent) {
  if (props.isBatchMode) {
    event.preventDefault();
    return;
  }
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    event.preventDefault();
    emit('toggleSelect', props.node.id, event);
    return;
  }

  if (isFolder.value) {
    toggleFolderCollapse(props.node.id);
  } else if (props.node.url) {
    openUrl(props.node.url, userSettings.value.openInNewTab);
  }
}

function handleDragStart(event: DragEvent) {
  if (!event.dataTransfer) return;
  const type = isFolder.value ? 'folder' : 'bookmark';
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(
    'application/json',
    JSON.stringify({
      type,
      id: props.node.id,
      parentId: props.parentFolderId || props.node.parentId,
      index: props.itemIndex,
      title: props.node.title,
      url: props.node.url,
    })
  );
  startGlobalDrag({
    type,
    id: props.node.id,
    parentId: props.parentFolderId || props.node.parentId,
    index: props.itemIndex,
  });
  if (isFolder.value) {
    startCardDrag({
      id: props.node.id,
      fromCol: -1,
      fromRow: props.itemIndex ?? 0,
    });
  }
  if (event.target instanceof HTMLElement) {
    event.target.classList.add('opacity-40');
  }
}

function handleDragEnd(event: DragEvent) {
  if (event.target instanceof HTMLElement) {
    event.target.classList.remove('opacity-40');
  }
  isDragOver.value = false;
  dropPosition.value = null;
  if (isFolder.value) {
    endCardDrag();
  }
  endGlobalDrag();
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  if (!event.dataTransfer) return;
  event.dataTransfer.dropEffect = 'move';

  // Do not drag onto self
  if (activeDragItem.value?.id === props.node.id) {
    return;
  }
  // Ignore folder_card dragging over normal bookmark rows
  if (globalDragType.value === 'folder_card' && !isFolder.value) {
    return;
  }

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const offsetY = event.clientY - rect.top;

  let newPos: 'inside' | 'before' | 'after';
  if (isFolder.value) {
    if (offsetY > rect.height * 0.25 && offsetY < rect.height * 0.75) {
      newPos = 'inside';
    } else if (offsetY <= rect.height * 0.25) {
      newPos = 'before';
    } else {
      newPos = 'after';
    }
  } else {
    newPos = offsetY < rect.height / 2 ? 'before' : 'after';
  }

  if (dropPosition.value !== newPos) {
    dropPosition.value = newPos;
  }
  if (!isDragOver.value) {
    isDragOver.value = true;
  }
}

function handleDragLeave(event: DragEvent) {
  const current = event.currentTarget as HTMLElement | null;
  const related = event.relatedTarget as HTMLElement | null;
  if (current && related && current.contains(related)) {
    return;
  }
  isDragOver.value = false;
  dropPosition.value = null;
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  isDragOver.value = false;
  const currentDropPos = dropPosition.value;
  dropPosition.value = null;
  endGlobalDrag();

  const raw = event.dataTransfer?.getData('application/json');
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    if (!data.id || data.id === props.node.id) return;

    const isMovedFolder = data.type === 'folder' || data.type === 'folder_card';
    const isMovedBookmark = data.type === 'bookmark';

    if (isMovedBookmark || isMovedFolder) {
      const extra = { title: data.title, url: data.url };
      if (isFolder.value && currentDropPos === 'inside') {
        const ok = await moveBookmark(data.id, props.node.id, undefined, extra);
        if (ok && data.type === 'folder_card') {
          removeFromColumnLayout(data.id);
        }
      } else {
        const targetParentId = props.parentFolderId || props.node.parentId;
        if (targetParentId) {
          let targetIndex = props.itemIndex ?? 0;
          if (currentDropPos === 'after') {
            targetIndex++;
          }
          const ok = await moveBookmark(data.id, targetParentId, targetIndex, extra);
          if (ok && data.type === 'folder_card') {
            removeFromColumnLayout(data.id);
          }
        }
      }
    }
  } catch (err) {
    console.error('[NTab] Error handling drop:', err);
  }
}

function handleDelete(event: MouseEvent) {
  event.stopPropagation();
  emit('deleteItem', props.node.id, isFolder.value);
}
</script>

<template>
  <div v-if="!isHidden && !isStandaloneCard" class="relative select-none leading-none">
    <div
      v-if="isDragOver && dropPosition === 'before'"
      class="absolute top-0 left-1 right-1 h-0.5 bg-indigo-500 rounded z-20 pointer-events-none shadow-xs"
    >
      <div class="absolute -top-[3px] -left-1 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-zinc-900"></div>
    </div>
    <div
      v-if="isDragOver && dropPosition === 'after'"
      class="absolute bottom-0 left-1 right-1 h-0.5 bg-indigo-500 rounded z-20 pointer-events-none shadow-xs"
    >
      <div class="absolute -bottom-[3px] -left-1 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-zinc-900"></div>
    </div>

    <div
      :data-bookmark-id="node.id"
      :draggable="!isBatchMode"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @pointerdown="handleRowPointerDown"
      @pointerenter="handleRowPointerEnter"
      @click="handleRowClick"
      @contextmenu.prevent.stop="handleContextMenu"
      class="group relative flex items-center rounded-lg cursor-pointer transition-colors overflow-hidden select-none"
      :style="{
        fontSize: 'var(--bookmark-font-size, 14px)',
        height: 'var(--bookmark-row-height, 32px)',
        minHeight: 'var(--bookmark-row-height, 32px)',
        transitionDuration: 'var(--hover-duration, 75ms)',
        paddingLeft: 'clamp(4px, calc(var(--bookmark-row-height, 32px) * 0.22), 10px)',
        paddingRight: 'clamp(4px, calc(var(--bookmark-row-height, 32px) * 0.22), 10px)',
        gap: 'clamp(4px, calc(var(--bookmark-row-height, 32px) * 0.22), 10px)',
      }"
      :class="[
        isSelected
          ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40 font-medium'
          : 'hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-900 dark:text-zinc-100',
        isDragOver && dropPosition === 'inside'
          ? 'ring-2 ring-indigo-500 bg-indigo-500/15'
          : '',
      ]"
      :title="node.title + (node.url ? '\n' + node.url : '')"
    >
      <div
        v-if="isBatchMode || isSelected"
        class="flex-shrink-0 flex items-center justify-center mr-0.5 pointer-events-none"
      >
        <input
          type="checkbox"
          :checked="isSelected"
          tabindex="-1"
          class="rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 dark:bg-zinc-900 pointer-events-none"
          :style="{
            width: 'clamp(11px, calc(var(--bookmark-row-height, 32px) - 6px), 16px)',
            height: 'clamp(11px, calc(var(--bookmark-row-height, 32px) - 6px), 16px)',
          }"
        />
      </div>

      <div
        v-if="isFolder || !shouldOmitLogo"
        class="flex-shrink-0 rounded-md bg-slate-100 dark:bg-white/10 flex items-center justify-center shadow-2xs overflow-hidden"
        :style="{
          width: 'clamp(12px, calc(var(--bookmark-row-height, 32px) - 6px), 20px)',
          height: 'clamp(12px, calc(var(--bookmark-row-height, 32px) - 6px), 20px)',
          padding: 'clamp(1px, calc(var(--bookmark-row-height, 32px) * 0.05), 2px)',
        }"
      >
        <template v-if="isFolder">
          <FolderOpen
            v-if="!isCollapsed"
            :class="['w-full h-full max-w-full max-h-full object-contain', folderColorClass]"
          />
          <Folder v-else :class="['w-full h-full max-w-full max-h-full object-contain', folderColorClass]" />
        </template>

        <template v-else>
          <img
            v-if="faviconSrc && !hasFaviconError"
            :src="faviconSrc"
            @error="hasFaviconError = true"
            class="w-full h-full max-w-full max-h-full rounded-xs object-contain"
            loading="lazy"
            alt=""
          />
          <Globe
            v-else
            class="w-full h-full max-w-full max-h-full object-contain text-slate-500 dark:text-zinc-400"
          />
        </template>
      </div>

      <span class="truncate flex-1 min-w-0 leading-none" :class="{ 'font-semibold': isFolder }">
        {{ displayTitle }}
      </span>

      <span
        v-if="!isFolder && domain && !shouldOmitLogo && userSettings.columnWidth >= 22"
        class="hidden group-hover:inline-block text-[11px] text-slate-400 dark:text-zinc-500 font-mono truncate max-w-[110px] flex-shrink-0 opacity-80 leading-none"
      >
        {{ domain }}
      </span>

      <span
        v-if="isFolder && node.children"
        class="font-mono flex-shrink-0 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-zinc-300 leading-none flex items-center justify-center"
        :style="{
          fontSize: 'clamp(8px, calc(var(--bookmark-font-size, 14px) * 0.78), 11px)',
          height: 'clamp(11px, calc(var(--bookmark-row-height, 32px) - 8px), 18px)',
          paddingLeft: 'clamp(3px, calc(var(--bookmark-row-height, 32px) * 0.15), 6px)',
          paddingRight: 'clamp(3px, calc(var(--bookmark-row-height, 32px) * 0.15), 6px)',
        }"
      >
        {{ node.children.length }}
      </span>

      <ChevronRight
        v-if="isFolder"
        class="text-slate-400 dark:text-zinc-500 transition-transform duration-200 flex-shrink-0"
        :class="{ 'rotate-90': !isCollapsed }"
        :style="{
          width: 'clamp(10px, calc(var(--bookmark-row-height, 32px) * 0.4), 14px)',
          height: 'clamp(10px, calc(var(--bookmark-row-height, 32px) * 0.4), 14px)',
        }"
      />

      <div
        v-if="!isBatchMode && !node.unmodifiable"
        class="opacity-0 group-hover:opacity-100 flex items-center transition-opacity flex-shrink-0"
        :style="{ transitionDuration: 'var(--hover-duration, 75ms)' }"
      >
        <button
          type="button"
          @click.stop="handleDelete"
          :title="t('common.delete')"
          class="rounded hover:bg-red-500/10 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer flex items-center justify-center"
          :style="{
            width: 'clamp(12px, calc(var(--bookmark-row-height, 32px) - 6px), 20px)',
            height: 'clamp(12px, calc(var(--bookmark-row-height, 32px) - 6px), 20px)',
          }"
        >
          <Trash2
            :style="{
              width: 'clamp(9px, calc(var(--bookmark-row-height, 32px) * 0.4), 14px)',
              height: 'clamp(9px, calc(var(--bookmark-row-height, 32px) * 0.4), 14px)',
            }"
          />
        </button>
      </div>
    </div>

    <div
      v-if="isFolder && !isCollapsed && node.children && node.children.length > 0"
      class="border-l-2 border-slate-200 dark:border-white/10 flex flex-col"
      :style="{
        paddingLeft: 'clamp(6px, calc(var(--bookmark-row-height, 32px) * 0.3), 14px)',
        marginLeft: 'clamp(5px, calc(var(--bookmark-row-height, 32px) * 0.22), 10px)',
        marginTop: 'clamp(1px, calc(var(--bookmark-row-height, 32px) * 0.08), 4px)',
        marginBottom: 'clamp(1px, calc(var(--bookmark-row-height, 32px) * 0.08), 4px)',
        gap: 'clamp(0px, calc(var(--bookmark-row-height, 32px) * 0.06), 2px)',
      }"
    >
      <BookmarkNode
        v-for="(child, idx) in node.children"
        :key="child.id"
        :node="child"
        :item-index="idx"
        :parent-folder-id="node.id"
        :level="(level || 0) + 1"
        :is-batch-mode="isBatchMode"
        :selected-ids="selectedIds"
        @toggle-select="(id, e) => emit('toggleSelect', id, e)"
        @delete-item="(id, folder) => emit('deleteItem', id, folder)"
        @open-context-menu="(payload) => emit('openContextMenu', payload)"
      />
    </div>

    <div
      v-else-if="isFolder && !isCollapsed && (!node.children || node.children.length === 0)"
      class="pl-6 py-1.5 text-xs text-slate-500 dark:text-zinc-400 italic"
    >
      {{ t('common.emptyFolder') }}
    </div>
  </div>
</template>
