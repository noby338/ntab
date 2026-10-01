import { ref } from 'vue';

export type DropTarget =
  | { type: 'column_slot'; slotIndex: number }
  | { type: 'card_slot'; colIndex: number; slotIndex: number }
  | { type: 'folder_nest'; folderId: string };

export const activeDropTarget = ref<DropTarget | null>(null);
export const activeDragCardInfo = ref<{
  id: string;
  fromCol: number;
  fromRow: number;
} | null>(null);

export function startCardDrag(info: { id: string; fromCol: number; fromRow: number }) {
  activeDragCardInfo.value = info;
  activeDropTarget.value = null;
}

export function endCardDrag() {
  activeDragCardInfo.value = null;
  activeDropTarget.value = null;
}

/**
 * Global coordinate-based drop target resolver.
 * Evaluates the exact (clientX, clientY) against all rendered columns and cards.
 * Guarantees exactly ONE deterministic, generous target at any time.
 */
export function resolveDropTarget(
  clientX: number,
  clientY: number
): DropTarget | null {
  const dragged = activeDragCardInfo.value;
  if (!dragged) return null;

  if (typeof document === 'undefined') return null;

  const columnEls = Array.from(
    document.querySelectorAll<HTMLElement>('[data-column-index]')
  ).sort((a, b) => {
    const ai = parseInt(a.getAttribute('data-column-index') || '0', 10);
    const bi = parseInt(b.getAttribute('data-column-index') || '0', 10);
    return ai - bi;
  });

  const N = columnEls.length;
  if (N === 0) return null;

  const colRects = columnEls.map((el) => el.getBoundingClientRect());

  const col0 = colRects[0];
  if (col0 && clientX < col0.left + Math.min(32, col0.width * 0.15)) {
    return { type: 'column_slot', slotIndex: 0 };
  }

  // Far Right Slot N: to the right of Column N - 1
  const colLast = colRects[N - 1];
  if (colLast && clientX > colLast.right - Math.min(32, colLast.width * 0.15)) {
    return { type: 'column_slot', slotIndex: N };
  }

  // Inter-Column Slots 1 to N - 1 (between Column k-1 and Column k)
  for (let k = 1; k < N; k++) {
    const leftCol = colRects[k - 1];
    const rightCol = colRects[k];
    if (leftCol && rightCol) {
      const margin = Math.min(32, Math.max(16, (rightCol.left - leftCol.right) / 2 + 16));
      const zoneStart = leftCol.right - margin;
      const zoneEnd = rightCol.left + margin;
      if (clientX >= zoneStart && clientX <= zoneEnd) {
        return { type: 'column_slot', slotIndex: k };
      }
    }
  }

  // -------------------------------------------------------------
  // 2. Identify Which Column Contains clientX
  // -------------------------------------------------------------
  let activeColIdx = -1;
  for (let c = 0; c < N; c++) {
    const rect = colRects[c];
    if (rect && clientX >= rect.left && clientX <= rect.right) {
      activeColIdx = c;
      break;
    }
  }

  // Fallback: nearest column horizontally
  if (activeColIdx === -1) {
    let minDiff = Infinity;
    for (let c = 0; c < N; c++) {
      const rect = colRects[c];
      if (rect) {
        const center = (rect.left + rect.right) / 2;
        const diff = Math.abs(clientX - center);
        if (diff < minDiff) {
          minDiff = diff;
          activeColIdx = c;
        }
      }
    }
  }

  if (activeColIdx === -1) return null;

  const targetColEl = columnEls[activeColIdx];
  if (!targetColEl) return null;

  const cardEls = Array.from(
    targetColEl.querySelectorAll<HTMLElement>('[data-card-id]')
  );
  const M = cardEls.length;

  // Empty column -> Card Slot 0
  if (M === 0) {
    return { type: 'card_slot', colIndex: activeColIdx, slotIndex: 0 };
  }

  const cardRects = cardEls.map((el) => el.getBoundingClientRect());

  const lastCard = cardRects[M - 1];
  if (lastCard && clientY > lastCard.bottom && clientY <= lastCard.bottom + 80) {
    return { type: 'card_slot', colIndex: activeColIdx, slotIndex: M };
  }

  const firstCard = cardRects[0];
  if (firstCard && clientY < firstCard.top && clientY >= firstCard.top - 80) {
    return { type: 'card_slot', colIndex: activeColIdx, slotIndex: 0 };
  }

  for (let j = 0; j < M; j++) {
    const cardRect = cardRects[j];
    const cardEl = cardEls[j];
    if (!cardRect || !cardEl) continue;

    const prevCard = j > 0 ? cardRects[j - 1] : null;
    const isGapAbove = prevCard && clientY > prevCard.bottom && clientY < cardRect.top;

    if (isGapAbove) {
      return { type: 'card_slot', colIndex: activeColIdx, slotIndex: j };
    }

    if (clientY >= cardRect.top && clientY <= cardRect.bottom) {
      const cardId = cardEl.getAttribute('data-card-id') || '';
      const isSpecial =
        cardId === 'top_sites' ||
        cardId === 'recently_closed' ||
        cardId === 'apps' ||
        cardId === 'recently_deleted';

      if (cardId === dragged.id) {
        return null;
      }

      if (isSpecial) {
        const cardCenterY = (cardRect.top + cardRect.bottom) / 2;
        return {
          type: 'card_slot',
          colIndex: activeColIdx,
          slotIndex: clientY < cardCenterY ? j : j + 1,
        };
      }

      if (clientY < cardRect.top + 8) {
        return { type: 'card_slot', colIndex: activeColIdx, slotIndex: j };
      }

      if (clientY > cardRect.bottom - 8) {
        return { type: 'card_slot', colIndex: activeColIdx, slotIndex: j + 1 };
      }

      const headerHeight = Math.min(52, Math.max(34, cardRect.height * 0.4));
      const isOverHeader = clientY <= cardRect.top + headerHeight;

      if (isOverHeader) {
        return { type: 'folder_nest', folderId: cardId };
      }

      const cardCenterY = (cardRect.top + cardRect.bottom) / 2;
      return {
        type: 'card_slot',
        colIndex: activeColIdx,
        slotIndex: clientY < cardCenterY ? j : j + 1,
      };
    }
  }

  return null;
}
