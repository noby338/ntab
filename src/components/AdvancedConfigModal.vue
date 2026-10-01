<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import {
  X,
  Code2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Save,
  Check,
} from '@lucide/vue';
import {
  saveSettings,
  saveColumnLayout,
  DEFAULT_SETTINGS,
  buildAdaptiveExportData,
  resolveAdaptiveImportData,
} from '../services/storage';
import { t } from '../locales';
import type { AdaptiveExportPayload } from '../types';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const codeText = ref('');
const isValid = ref(true);
const validationError = ref<{ line: number; column?: number; message: string } | null>(null);
const appliedNotification = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

function validateJson(text: string) {
  if (!text.trim()) {
    isValid.value = false;
    validationError.value = { line: 1, message: 'JSON content is empty' };
    return;
  }
  try {
    JSON.parse(text);
    isValid.value = true;
    validationError.value = null;
  } catch (err: any) {
    isValid.value = false;
    let line = 1;
    let col = 1;
    const msg = err?.message || 'Syntax error';

    const lineColMatch = msg.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    const lineMatch = msg.match(/line\s+(\d+)/i);
    const posMatch = msg.match(/at position\s+(\d+)/i) || msg.match(/column\s+(\d+)/i);

    if (lineColMatch) {
      line = parseInt(lineColMatch[1] || '1', 10);
      col = parseInt(lineColMatch[2] || '1', 10);
    } else if (lineMatch) {
      line = parseInt(lineMatch[1] || '1', 10);
    } else if (posMatch) {
      const pos = parseInt(posMatch[1] || '0', 10);
      const textUpToPos = text.slice(0, pos);
      line = textUpToPos.split('\n').length;
      const lastLine = textUpToPos.split('\n').pop() || '';
      col = lastLine.length + 1;
    }

    validationError.value = {
      line,
      column: col,
      message: msg,
    };
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      appliedNotification.value = false;
      const data = buildAdaptiveExportData();
      codeText.value = JSON.stringify(data, null, 2);
      validateJson(codeText.value);
    }
  }
);

function handleInput() {
  validateJson(codeText.value);
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const textarea = e.target as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    codeText.value = codeText.value.substring(0, start) + '  ' + codeText.value.substring(end);
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      validateJson(codeText.value);
    });
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    handleSaveAndApply();
  }
}

function handlePrettify() {
  try {
    const parsed = JSON.parse(codeText.value);
    codeText.value = JSON.stringify(parsed, null, 2);
    validateJson(codeText.value);
  } catch {}
}

function handleResetDefault() {
  const defaultData: AdaptiveExportPayload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: { ...DEFAULT_SETTINGS },
    layout: [
      [{ rootId: '1', title: 'Bookmarks Bar' }],
      [{ rootId: '2', title: 'Other Bookmarks' }],
      [{ specialId: 'top_sites' }, { specialId: 'recently_closed' }],
    ],
  };
  codeText.value = JSON.stringify(defaultData, null, 2);
  validateJson(codeText.value);
}

async function handleSaveAndApply() {
  if (!isValid.value) return;
  try {
    const parsed = JSON.parse(codeText.value);
    const { settings, columns } = resolveAdaptiveImportData(parsed);

    await saveSettings(settings);
    saveColumnLayout({ columns });

    appliedNotification.value = true;
    setTimeout(() => {
      appliedNotification.value = false;
    }, 2500);
  } catch (err: any) {
    alert(err?.message || 'Error applying configuration');
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 scale-98"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-98"
  >
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none"
      @click.self="emit('close')"
    >
      <div
        class="w-[94vw] max-w-5xl h-[88vh] theme-popover rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-black/10 dark:border-white/10"
        style="font-size: 14px;"
      >
        <div class="flex items-center justify-between px-6 py-3.5 border-b border-black/5 dark:border-white/5">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center flex-shrink-0">
              <Code2 class="w-4 h-4" />
            </div>
            <div>
              <div class="font-bold text-base text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <span>{{ t('settings.advancedEditorTitle') }}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono">JSON v2</span>
              </div>
              <div class="text-[11px] text-slate-400">{{ t('settings.advancedEditorSubtitle') }}</div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="handlePrettify"
              :title="t('settings.prettifyJson')"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              <Sparkles class="w-3.5 h-3.5 text-indigo-500" />
              <span>{{ t('settings.prettifyJson') }}</span>
            </button>

            <button
              type="button"
              @click="handleResetDefault"
              :title="t('settings.resetDefaultJson')"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              <RotateCcw class="w-3.5 h-3.5 text-amber-500" />
              <span>{{ t('settings.resetDefaultJson') }}</span>
            </button>

            <button
              type="button"
              @click="emit('close')"
              class="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors ml-2 cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <div class="flex-1 relative flex overflow-hidden bg-slate-50/60 dark:bg-black/40">
          <textarea
            ref="textareaRef"
            v-model="codeText"
            @input="handleInput"
            @keydown="handleKeyDown"
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            class="w-full h-full p-5 font-mono text-[13px] leading-relaxed resize-none focus:outline-none bg-transparent"
            style="color: var(--text-main); tab-size: 2;"
          ></textarea>
        </div>

        <div class="px-6 py-3 border-t border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2 min-w-0 flex-1 mr-4">
            <div
              v-if="isValid"
              class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10"
            >
              <CheckCircle2 class="w-4 h-4 flex-shrink-0" />
              <span class="truncate">{{ t('settings.validJson') }}</span>
            </div>

            <div
              v-else-if="validationError"
              class="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium px-2.5 py-1 rounded-lg bg-red-500/10 truncate max-w-md"
            >
              <AlertTriangle class="w-4 h-4 flex-shrink-0" />
              <span class="truncate">{{ t('settings.invalidJson', { line: validationError.line, message: validationError.message }) }}</span>
            </div>

            <div
              v-if="appliedNotification"
              class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded animate-in fade-in"
            >
              <Check class="w-3.5 h-3.5" />
              <span>{{ t('settings.liveApplied') }}</span>
            </div>
          </div>

          <div class="flex items-center gap-2.5 flex-shrink-0">
            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              {{ t('common.close') }}
            </button>

            <button
              type="button"
              @click="handleSaveAndApply"
              :disabled="!isValid"
              class="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <Save class="w-3.5 h-3.5" />
              <span>{{ t('settings.saveAndApply') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
