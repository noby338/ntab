import { ref } from 'vue';

export interface ActiveDragInfo {
  type: 'bookmark' | 'folder' | 'folder_card';
  id: string;
  parentId?: string;
  index?: number;
  fromCol?: number;
  fromRow?: number;
}

export const isGlobalDragging = ref(false);
export const globalDragType = ref<'bookmark' | 'folder' | 'folder_card' | null>(null);
export const activeDragItem = ref<ActiveDragInfo | null>(null);

export const activeColumnInsertSlot = ref<number | null>(null);
export const activeColumnBottomDropCol = ref<number | null>(null);
export const activeCardDropTarget = ref<{
  cardId: string;
  position: 'before' | 'after' | 'inside';
} | null>(null);

export function resetCardDragState() {
  activeColumnInsertSlot.value = null;
  activeColumnBottomDropCol.value = null;
  activeCardDropTarget.value = null;
}

let scrollAnimationFrame: number | null = null;
let currentScrollSpeedY = 0;
let currentScrollSpeedX = 0;
let targetScrollElement: HTMLElement | Window = window;

function findScrollableParent(el: HTMLElement | null): HTMLElement | Window {
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    const canScrollY = (overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight;
    const canScrollX = (overflowX === 'auto' || overflowX === 'scroll') && current.scrollWidth > current.clientWidth;
    if (canScrollY || canScrollX) {
      return current;
    }
    current = current.parentElement;
  }
  const mainEl = typeof document !== 'undefined' ? document.querySelector('main') : null;
  if (mainEl && mainEl.scrollWidth > mainEl.clientWidth) {
    return mainEl;
  }
  return window;
}

function processAutoScroll() {
  if (currentScrollSpeedY === 0 && currentScrollSpeedX === 0) {
    if (scrollAnimationFrame) {
      cancelAnimationFrame(scrollAnimationFrame);
      scrollAnimationFrame = null;
    }
    return;
  }

  if (targetScrollElement === window) {
    window.scrollBy({ left: currentScrollSpeedX, top: currentScrollSpeedY, behavior: 'auto' });
  } else if (targetScrollElement instanceof HTMLElement) {
    targetScrollElement.scrollTop += currentScrollSpeedY;
    targetScrollElement.scrollLeft += currentScrollSpeedX;
  }

  scrollAnimationFrame = requestAnimationFrame(processAutoScroll);
}

export function startGlobalDrag(info: ActiveDragInfo) {
  isGlobalDragging.value = true;
  globalDragType.value = info.type;
  activeDragItem.value = info;
}

export function endGlobalDrag() {
  isGlobalDragging.value = false;
  globalDragType.value = null;
  activeDragItem.value = null;
  resetCardDragState();
  currentScrollSpeedY = 0;
  currentScrollSpeedX = 0;
  if (scrollAnimationFrame) {
    cancelAnimationFrame(scrollAnimationFrame);
    scrollAnimationFrame = null;
  }
}

export function handleGlobalDragOver(e: DragEvent) {
  if (!isGlobalDragging.value) {
    isGlobalDragging.value = true;
  }

  const x = e.clientX;
  const y = e.clientY;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const edgeThresholdY = 90;
  const edgeThresholdX = 100;

  targetScrollElement = findScrollableParent(e.target as HTMLElement | null);

  if (y < edgeThresholdY) {
    const intensity = (edgeThresholdY - y) / edgeThresholdY;
    currentScrollSpeedY = -Math.round(4 + intensity * 20);
  } else if (y > viewportHeight - edgeThresholdY) {
    const intensity = (y - (viewportHeight - edgeThresholdY)) / edgeThresholdY;
    currentScrollSpeedY = Math.round(4 + intensity * 20);
  } else {
    currentScrollSpeedY = 0;
  }

  if (x < edgeThresholdX) {
    const intensity = (edgeThresholdX - x) / edgeThresholdX;
    currentScrollSpeedX = -Math.round(6 + intensity * 24);
  } else if (x > viewportWidth - edgeThresholdX) {
    const intensity = (x - (viewportWidth - edgeThresholdX)) / edgeThresholdX;
    currentScrollSpeedX = Math.round(6 + intensity * 24);
  } else {
    currentScrollSpeedX = 0;
  }

  if ((currentScrollSpeedY !== 0 || currentScrollSpeedX !== 0) && !scrollAnimationFrame) {
    scrollAnimationFrame = requestAnimationFrame(processAutoScroll);
  }
}

export function handleGlobalDragEnd() {
  endGlobalDrag();
}

export function initGlobalDragScroll() {
  if (typeof window === 'undefined') return;
  window.addEventListener('dragover', handleGlobalDragOver);
  window.addEventListener('dragend', endGlobalDrag);
  window.addEventListener('drop', endGlobalDrag);
  window.addEventListener('mouseup', endGlobalDrag);
  window.addEventListener('mouseleave', endGlobalDrag);
}
