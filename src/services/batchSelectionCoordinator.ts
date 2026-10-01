import { ref } from 'vue';

export const isBatchPointerSelecting = ref(false);
export const batchTargetSelectState = ref<boolean>(true);

type BatchSelectHandler = (id: string, selectState: boolean) => void;
let registeredHandler: BatchSelectHandler | null = null;

let lastPointerX = 0;
let lastPointerY = 0;

export function setBatchSelectHandler(handler: BatchSelectHandler | null) {
  registeredHandler = handler;
}

export function startBatchSelect(initialSelectState: boolean, clientX?: number, clientY?: number) {
  isBatchPointerSelecting.value = true;
  batchTargetSelectState.value = initialSelectState;
  if (clientX !== undefined && clientY !== undefined) {
    lastPointerX = clientX;
    lastPointerY = clientY;
  }
}

export function endBatchSelect() {
  isBatchPointerSelecting.value = false;
}

export function triggerSelectId(id: string, selectState: boolean) {
  if (registeredHandler) {
    registeredHandler(id, selectState);
  }
}

function processPointerMovement(currentX: number, currentY: number) {
  if (!isBatchPointerSelecting.value || !registeredHandler) return;

  const dx = currentX - lastPointerX;
  const dy = currentY - lastPointerY;
  const dist = Math.hypot(dx, dy);

  // Sample every 10px along the vector to capture all rows passed through
  const steps = Math.max(1, Math.ceil(dist / 10));

  for (let i = 1; i <= steps; i++) {
    const sampleX = lastPointerX + (dx * i) / steps;
    const sampleY = lastPointerY + (dy * i) / steps;
    const targetElement = document.elementFromPoint(sampleX, sampleY);
    const rowEl = targetElement?.closest<HTMLElement>('[data-bookmark-id]');
    if (rowEl) {
      const id = rowEl.getAttribute('data-bookmark-id');
      if (id) {
        registeredHandler(id, batchTargetSelectState.value);
      }
    }
  }

  lastPointerX = currentX;
  lastPointerY = currentY;
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      if (!isBatchPointerSelecting.value) return;
      if (e.buttons !== 1) {
        endBatchSelect();
        return;
      }
      processPointerMovement(e.clientX, e.clientY);
    },
    { passive: true }
  );

  window.addEventListener('pointerup', () => {
    endBatchSelect();
  });

  window.addEventListener('mouseup', () => {
    endBatchSelect();
  });

  window.addEventListener('dragend', () => {
    endBatchSelect();
  });
}
