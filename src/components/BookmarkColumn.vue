<script setup lang="ts">
import { computed } from 'vue';
import FolderCard from './FolderCard.vue';
import { userSettings } from '../services/storage';
import { activeDropTarget } from '../services/cardDragCoordinator';
import { t } from '../locales';
import type { BookmarkItem } from '../types';

const props = defineProps<{
  colIndex: number;
  folderIds: string[];
  isBatchMode: boolean;
  selectedIds: Set<string>;
  isLastColumn?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggleSelect', id: string, event: MouseEvent): void;
  (e: 'deleteItem', id: string, isFolder: boolean): void;
  (e: 'openContextMenu', payload: { node: BookmarkItem; x: number; y: number }): void;
  (e: 'openCreateFolder', parentId: string): void;
  (
    e: 'moveFolder',
    payload: {
      fromCol: number;
      fromRow: number;
      toCol: number;
      toRow: number;
      direction?: 'before' | 'after' | 'left' | 'right' | 'slot' | 'card_slot';
      slotIndex?: number;
    }
  ): void;
}>();

const columnWidthStyle = computed(() => {
  const percent = Math.max(15, Math.min(100, userSettings.value.columnWidth || 25));
  const gap = userSettings.value.columnGap || 20;
  // Gap compensation formula: deduction = gap * (1 - percent / 100)
  // Ensures (100 / percent) columns + gaps exactly fill 100% of the screen container
  const deduction = (gap * (1 - percent / 100)).toFixed(1);
  const widthExpr = percent >= 100 ? '100%' : `calc(${percent}% - ${deduction}px)`;

  return {
    width: widthExpr,
    flex: `0 0 ${widthExpr}`,
    minWidth: '180px',
    maxWidth: '100%',
    gap: 'clamp(6px, calc(var(--bookmark-row-height, 32px) * 0.4), 14px)',
  };
});
</script>

<template>
  <div
    :data-column-index="colIndex"
    class="relative flex flex-col pt-2 transition-[width] duration-150 min-h-0"
    :style="columnWidthStyle"
  >
    <!-- Full-Height Column Slot Indicator (Left) -->
    <div
      v-if="activeDropTarget?.type === 'column_slot' && activeDropTarget.slotIndex === colIndex"
      class="absolute -top-3 -bottom-3 -left-[calc(var(--column-gap,20px)/2+1px)] w-1.5 bg-indigo-500 rounded-full z-40 shadow-lg shadow-indigo-500/30 pointer-events-none transition-all duration-150 animate-in fade-in"
    >
      <div class="absolute -top-2 -left-1 w-3.5 h-3.5 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-zinc-900 shadow-md"></div>
      <div class="absolute -bottom-2 -left-1 w-3.5 h-3.5 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-zinc-900 shadow-md"></div>
    </div>

    <!-- Full-Height Column Slot Indicator (Right on last column) -->
    <div
      v-if="activeDropTarget?.type === 'column_slot' && activeDropTarget.slotIndex === colIndex + 1 && isLastColumn"
      class="absolute -top-3 -bottom-3 -right-[calc(var(--column-gap,20px)/2+1px)] w-1.5 bg-indigo-500 rounded-full z-40 shadow-lg shadow-indigo-500/30 pointer-events-none transition-all duration-150 animate-in fade-in"
    >
      <div class="absolute -top-2 -left-1 w-3.5 h-3.5 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-zinc-900 shadow-md"></div>
      <div class="absolute -bottom-2 -left-1 w-3.5 h-3.5 rounded-full bg-indigo-600 ring-2 ring-white dark:ring-zinc-900 shadow-md"></div>
    </div>

    <!-- Cards in this column -->
    <FolderCard
      v-for="(folderId, rowIndex) in folderIds"
      :key="folderId"
      :folder-id="folderId"
      :col-index="colIndex"
      :row-index="rowIndex"
      :is-batch-mode="isBatchMode"
      :selected-ids="selectedIds"
      @toggle-select="(id, e) => emit('toggleSelect', id, e)"
      @delete-item="(id, isF) => emit('deleteItem', id, isF)"
      @move-folder="(payload) => emit('moveFolder', payload)"
      @open-context-menu="(payload) => emit('openContextMenu', payload)"
      @open-create-folder="(parentId) => emit('openCreateFolder', parentId)"
    />

    <!-- Bottom Drop Slot (Append to this column) -->
    <div
      v-if="activeDropTarget?.type === 'card_slot' && activeDropTarget.colIndex === colIndex && activeDropTarget.slotIndex === folderIds.length"
      class="h-8 border border-dashed border-indigo-500/70 rounded-xl bg-indigo-500/10 flex items-center justify-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 select-none animate-in fade-in duration-100 flex-shrink-0"
    >
      {{ t('card.dropToEnd') || '放置在此列末尾' }}
    </div>
  </div>
</template>
