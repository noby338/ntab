<script setup lang="ts">
import { AlertTriangle } from '@lucide/vue';
import { t } from '../locales';

defineProps<{
  isOpen: boolean;
  title: string;
  description: string;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();
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
      @click.self="emit('cancel')"
    >
      <div
        class="w-full max-w-sm theme-popover rounded-3xl p-6 text-sm shadow-2xl"
        style="font-size: 14px;"
      >
        <div class="flex items-center gap-3 mb-3">
          <div class="w-9 h-9 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0">
            <AlertTriangle class="w-5 h-5" />
          </div>
          <h3 class="font-bold text-slate-900 dark:text-zinc-100 leading-snug truncate">
            {{ title }}
          </h3>
        </div>

        <p class="text-xs text-slate-500 dark:text-zinc-400 mb-6 leading-relaxed">
          {{ description }}
        </p>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
          <button
            type="button"
            @click="emit('cancel')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            @click="emit('confirm')"
            class="px-4 py-1.5 rounded-xl text-xs font-medium bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors cursor-pointer"
          >
            {{ t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
