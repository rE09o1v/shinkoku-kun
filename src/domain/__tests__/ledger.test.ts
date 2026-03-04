import { describe, expect, it } from "vitest";
import {
  normalizeImportYear,
  normalizeImportMonth,
  transformImportCategory,
  shouldSkipImportCategory,
  computeNetSummary,
  type SummaryEntry,
} from "../ledger";

describe("import normalization", () => {
  it("normalizes Japanese 2-digit year to 4-digit", () => {
    expect(normalizeImportYear("24年")).toBe(2024);
    expect(normalizeImportYear("2023")).toBe(2023);
  });

  it("rejects invalid year", () => {
    expect(normalizeImportYear("abc")).toBeNull();
    expect(normalizeImportYear("1900")).toBeNull();
  });

  it("normalizes month and validates range", () => {
    expect(normalizeImportMonth("1")).toBe(1);
    expect(normalizeImportMonth(12)).toBe(12);
    expect(normalizeImportMonth("13")).toBeNull();
  });

  it("transforms and filters categories correctly", () => {
    expect(transformImportCategory("駐車場代")).toBe("交通費");
    expect(transformImportCategory("本業売上")).toBe("本業売上");
    expect(shouldSkipImportCategory("収入")).toBe(true);
    expect(shouldSkipImportCategory("総売上")).toBe(true);
    expect(shouldSkipImportCategory("売上")).toBe(false);
  });
});

describe("net summary", () => {
  it("computes monthly/yearly net with integer-yen determinism", () => {
    const rows: SummaryEntry[] = [
      { amountYen: 1000, kind: "income" },
      { amountYen: 2500, kind: "income" },
      { amountYen: 900, kind: "expense" },
      { amountYen: 100, kind: "expense" },
      { amountYen: -50, kind: "expense" },
    ];

    const summary = computeNetSummary(rows);
    expect(summary.totalIncomeYen).toBe(3500);
    expect(summary.totalExpenseYen).toBe(950);
    expect(summary.netYen).toBe(2550);
  });
});
