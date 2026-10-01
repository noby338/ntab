<script setup lang="ts">
import { ref } from 'vue';
import { Trash2, X, FolderInput, CheckSquare } from '@lucide/vue';
import { folderMap } from '../services/bookmarks';
import { t } from '../locales';

const props = defineProps<{
  selectedCount: number;
  isVisible: boolean;
}>();

const emit = defineEmits<{
  (e: 'confirmDelete'): void;
  (e: 'clearSelection'): void;
  (e: 'moveToFolder', targetFolderId: string): void;
}>();

const showMoveMenu = ref(false);
const targetMoveFolder = ref('');

function handleMove() {
  if (!targetMoveFolder.value) return;
  emit('moveToFolder', targetMoveFolder.value);
  showMoveMenu.value = false;
  targetMoveFolder.value = '';
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out transform"
    enter-from-class="translate-y-12 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-150 ease-in transform"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-12 opacity-0"
  >
    <div
      v-if="isVisible"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-700/80 shadow-2xl rounded-2xl text-sm"
    >
      <!-- Counter / Mode badge -->
      <div class="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-zinc-700">
        <CheckSquare class="w-4 h-4 text-indigo-500" />
        <span class="font-medium text-slate-800 dark:text-zinc-200 whitespace-nowrap">
          {{ selectedCount > 0 ? t('batch.selectedCount', { count: selectedCount }) : t('header.batchManage') }}
        </span>
      </div>

      <!-- Action: Batch Delete -->
      <button
        v-if="selectedCount > 0"
        type="button"
        @click="emit('confirmDelete')"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white font-medium transition-colors cursor-pointer"
      >
        <Trash2 class="w-4 h-4" />
        <span>{{ t('batch.delete') }}</span>
      </button>

      <!-- Action: Move to Folder -->
      <div v-if="selectedCount > 0" class="relative">
        <button
          type="button"
          @click="showMoveMenu = !showMoveMenu"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
        >
          <FolderInput class="w-4 h-4" />
          <span>{{ t('batch.moveTo') }}</span>
        </button>

        <!-- Move dropdown -->
        <div
          v-if="showMoveMenu"
          class="absolute bottom-full mb-2 left-0 w-64 max-h-60 overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl p-2 z-50 text-xs"
        >
          <div class="px-2 py-1 font-semibold text-slate-400 dark:text-zinc-500">
            {{ t('createFolder.parentLabel') }}
          </div>
          <button
            v-for="[id, folder] in folderMap"
            :key="id"
            type="button"
            @click="targetMoveFolder = id; handleMove()"
            class="w-full text-left px-2 py-1.5 rounded hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 truncate cursor-pointer"
          >
            <span>📁</span>
            <span class="truncate">{{ folder.title || t('common.unnamed') }}</span>
          </button>
        </div>
      </div>

      <!-- Cancel / Exit Selection -->
      <button
        type="button"
        @click="emit('clearSelection')"
        :title="t('common.cancel') + ' (Esc)'"
        class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </Transition>
</template>
