import { describe, expect, it } from "vitest";

import {
  areAllEntryIdsSelected,
  normalizeEntryIds,
  reconcileSelectedEntryIds,
  toggleAllEntryIds,
  toggleAllEntrySelection,
  toggleEntrySelection,
  toggleSelectedEntryId,
} from "./entrySelection";

describe("entrySelection", () => {
  it("normalizes IDs by removing duplicates and invalid values", () => {
    expect(normalizeEntryIds([4, 2, 4, -1, 0, 3.5, 2])).toEqual([4, 2]);
  });

  it("reconciles selection against visible rows", () => {
    expect(reconcileSelectedEntryIds([9, 3, 3, 1], [1, 2, 3])).toEqual([3, 1]);
  });

  it("toggles a single entry without losing other selections", () => {
    expect(toggleEntrySelection([1, 2], 3, true)).toEqual([1, 2, 3]);
    expect(toggleEntrySelection([1, 2, 3], 2, false)).toEqual([1, 3]);
  });

  it("toggles all visible entries at once", () => {
    expect(toggleAllEntrySelection([8, 2, 8, 4], true)).toEqual([8, 2, 4]);
    expect(toggleAllEntrySelection([8, 2, 4], false)).toEqual([]);
  });

  it("detects whether all visible rows are selected", () => {
    expect(areAllEntryIdsSelected([5, 7, 9], [{ id: 7 }, { id: 5 }])).toBe(true);
    expect(areAllEntryIdsSelected([5], [{ id: 7 }, { id: 5 }])).toBe(false);
    expect(areAllEntryIdsSelected([5], [])).toBe(false);
  });

  it("toggles helper wrappers used by the table UI", () => {
    expect(toggleSelectedEntryId([1, 4], 2)).toEqual([1, 4, 2]);
    expect(toggleSelectedEntryId([1, 4], 4)).toEqual([1]);
    expect(toggleAllEntryIds([1], [{ id: 1 }, { id: 4 }])).toEqual([1, 4]);
    expect(toggleAllEntryIds([1, 4], [{ id: 1 }, { id: 4 }])).toEqual([]);
  });
});
