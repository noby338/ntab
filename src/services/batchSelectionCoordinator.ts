import { ref } from 'vue';

export const isBatchPointerSelecting = ref(false);
export const batchTargetSelectState = ref<boolean>(true);

export function startBatchSelect(initialSelectState: boolean) {
  isBatchPointerSelecting.value = true;
  batchTargetSelectState.value = initialSelectState;
}

export function endBatchSelect() {
  isBatchPointerSelecting.value = false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerup', () => {
    isBatchPointerSelecting.value = false;
  });
  window.addEventListener('mouseup', () => {
    isBatchPointerSelecting.value = false;
  });
  window.addEventListener('dragend', () => {
    isBatchPointerSelecting.value = false;
  });
}
