<script setup lang="ts">
import { ref, watch } from 'vue';
import { X, FolderPlus } from '@lucide/vue';
import { folderMap, createFolder } from '../services/bookmarks';
import { addToColumnLayout } from '../services/storage';
import { t } from '../locales';

const props = defineProps<{
  isOpen: boolean;
  initialParentId?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const folderName = ref('');
const selectedParentId = ref('2');
const asStandaloneCard = ref(true);
const isSubmitting = ref(false);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      folderName.value = '';
      selectedParentId.value = props.initialParentId || '2';
      asStandaloneCard.value = true;
    }
  }
);

async function handleCreate() {
  const name = folderName.value.trim();
  if (!name || isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    const newFolder = await createFolder(selectedParentId.value, name);
    if (newFolder && asStandaloneCard.value) {
      addToColumnLayout(newFolder.id, 0, 0);
    }
    emit('close');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition duration-100 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-sm theme-popover rounded-3xl p-6 text-sm shadow-2xl"
        style="font-size: 14px;"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <FolderPlus class="w-4 h-4" />
            </div>
            <h3 class="font-bold text-slate-900 dark:text-zinc-100">{{ t('createFolder.title') }}</h3>
          </div>
          <button
            type="button"
            @click="emit('close')"
            class="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <form @submit.prevent="handleCreate" class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {{ t('createFolder.nameLabel') }}
            </label>
            <input
              v-model="folderName"
              type="text"
              :placeholder="t('createFolder.namePlaceholder')"
              autofocus
              class="w-full px-3 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style="background-color: var(--item-hover); border: 1px solid var(--card-border); color: var(--text-main);"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {{ t('createFolder.parentLabel') }}
            </label>
            <select
              v-model="selectedParentId"
              class="w-full px-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              style="background-color: var(--item-hover); border: 1px solid var(--card-border); color: var(--text-main);"
            >
              <option value="2">📁 {{ t('createFolder.otherBookmarks') }}</option>
              <option value="1">🗂️ {{ t('createFolder.bookmarksBar') }}</option>
              <template v-for="[id, folder] in folderMap" :key="id">
                <option v-if="id !== '1' && id !== '2'" :value="id">
                  ↳ {{ folder.title || t('common.unnamed') }}
                </option>
              </template>
            </select>
          </div>

          <label class="flex items-center gap-2 cursor-pointer pt-1">
            <input
              v-model="asStandaloneCard"
              type="checkbox"
              class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span class="text-xs text-slate-600 dark:text-zinc-300">
              {{ t('createFolder.asStandaloneCard') }}
            </span>
          </label>

          <div class="mt-6 flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              @click="emit('close')"
              class="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="submit"
              :disabled="!folderName.trim() || isSubmitting"
              class="px-4 py-1.5 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm transition-colors cursor-pointer"
            >
              {{ t('common.create') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>
