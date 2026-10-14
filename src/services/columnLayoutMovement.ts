export const MAX_COLUMNS = 10;

export type LayoutDropTarget =
  | { type: 'column_slot'; slotIndex: number }
  | { type: 'card_slot'; colIndex: number; slotIndex: number };

// Resolve visible indices before removing the dragged card: hidden cards and an
// emptied source column must not change which column the user targeted.
export function moveLayoutCard(
  columns: string[][],
  displayed: string[][],
  cardId: string,
  target: LayoutDropTarget,
): string[][] | null {
  const cols = columns.map(col => [...col]);
  const visibleIds = new Set(displayed.flat());
  visibleIds.add(cardId);
  const countVisible = (layout: string[][]) => layout.filter(col => col.some(id => visibleIds.has(id))).length;
  const originalCount = countVisible(cols);
  const visibleColumnIndex = (index: number) => cols.findIndex(col => col.includes(displayed[index]?.[0] || ''));
  const targetIndex = target.type === 'column_slot'
    ? (target.slotIndex >= displayed.length ? cols.length : visibleColumnIndex(target.slotIndex))
    : visibleColumnIndex(target.colIndex);
  if (targetIndex < 0) return null;

  for (const col of cols) {
    const index = col.indexOf(cardId);
    if (index >= 0) col.splice(index, 1);
  }
  if (target.type === 'column_slot') {
    cols.splice(targetIndex, 0, [cardId]);
  } else {
    const targetCol = cols[targetIndex]!;
    // Find the next visible card after this slot, excluding the dragged card.
    const anchor = displayed[target.colIndex]?.slice(target.slotIndex).find(id => id !== cardId);
    const position = anchor ? targetCol.indexOf(anchor) : targetCol.length;
    targetCol.splice(position < 0 ? targetCol.length : position, 0, cardId);
  }
  const cleaned = cols.filter(col => col.length > 0);
  const count = countVisible(cleaned);
  // Preserve legacy/imported layouts over the limit; allow moves that do not grow them.
  if (count > MAX_COLUMNS && count > originalCount) return null;
  return cleaned;
}
