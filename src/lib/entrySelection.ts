export function normalizeEntryIds(entryIds: number[]): number[] {
  return Array.from(
    new Set(entryIds.filter((entryId) => Number.isInteger(entryId) && entryId > 0)),
  );
}

export function reconcileSelectedEntryIds(
  selectedEntryIds: number[],
  visibleEntryIds: number[],
): number[] {
  const visibleIds = new Set(normalizeEntryIds(visibleEntryIds));
  return normalizeEntryIds(selectedEntryIds).filter((entryId) => visibleIds.has(entryId));
}

export function toggleEntrySelection(
  selectedEntryIds: number[],
  entryId: number,
  checked: boolean,
): number[] {
  const nextIds = new Set(normalizeEntryIds(selectedEntryIds));
  if (checked) {
    nextIds.add(entryId);
  } else {
    nextIds.delete(entryId);
  }
  return Array.from(nextIds);
}

export function toggleAllEntrySelection(visibleEntryIds: number[], checked: boolean): number[] {
  return checked ? normalizeEntryIds(visibleEntryIds) : [];
}

export function areAllEntryIdsSelected(
  selectedEntryIds: number[],
  visibleEntries: Array<{ id: number }>,
): boolean {
  const visibleEntryIds = normalizeEntryIds(visibleEntries.map((entry) => entry.id));
  if (visibleEntryIds.length === 0) {
    return false;
  }

  const selectedEntryIdSet = new Set(normalizeEntryIds(selectedEntryIds));
  return visibleEntryIds.every((entryId) => selectedEntryIdSet.has(entryId));
}

export function toggleSelectedEntryId(selectedEntryIds: number[], entryId: number): number[] {
  const selectedEntryIdSet = new Set(normalizeEntryIds(selectedEntryIds));
  return toggleEntrySelection(selectedEntryIds, entryId, !selectedEntryIdSet.has(entryId));
}

export function toggleAllEntryIds(
  selectedEntryIds: number[],
  visibleEntries: Array<{ id: number }>,
): number[] {
  return toggleAllEntrySelection(
    visibleEntries.map((entry) => entry.id),
    !areAllEntryIdsSelected(selectedEntryIds, visibleEntries),
  );
}
