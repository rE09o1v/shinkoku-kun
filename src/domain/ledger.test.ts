import { describe, expect, it } from "vitest";
import {
  normalizeImportCategory,
  normalizeImportYear,
  summarizeEntries,
  validateEntryDraft,
  type LedgerCategory,
  type LedgerEntry,
} from "./ledger";

describe("ledger domain", () => {
  const categories: LedgerCategory[] = [
    { id: 1, name: "本業売上", kind: "income", inputEnabled: true },
    { id: 2, name: "出前売上", kind: "income", inputEnabled: true },
    { id: 3, name: "交通費", kind: "expense", inputEnabled: true },
    { id: 4, name: "売上", kind: "income", inputEnabled: false },
  ];

  it("summarizeEntries: kindベースで収入・支出・収支を計算する", () => {
    const entries: LedgerEntry[] = [
      { id: 1, profileId: 1, year: 2024, month: 4, categoryId: 1, amount: 120000, source: "manual" },
      { id: 2, profileId: 1, year: 2024, month: 4, categoryId: 2, amount: 40000, source: "manual" },
      { id: 3, profileId: 1, year: 2024, month: 4, categoryId: 3, amount: 12000, source: "manual" },
      { id: 4, profileId: 1, year: 2024, month: 4, categoryId: 4, amount: 8000, source: "import" },
    ];

    const summary = summarizeEntries(entries, categories);

    expect(summary.incomeTotal).toBe(168000);
    expect(summary.expenseTotal).toBe(12000);
    expect(summary.net).toBe(156000);
    expect(summary.categoryTotals.get("本業売上")).toBe(120000);
    expect(summary.categoryTotals.get("交通費")).toBe(12000);
  });

  it("normalizeImportCategory: 除外カテゴリと変換カテゴリを処理する", () => {
    expect(normalizeImportCategory("収入")).toBeNull();
    expect(normalizeImportCategory("総売上")).toBeNull();
    expect(normalizeImportCategory("駐車場代")).toBe("交通費");
    expect(normalizeImportCategory("売上")).toBe("売上");
  });

  it("normalizeImportYear: YY年を西暦へ正規化する", () => {
    expect(normalizeImportYear("24年")).toBe(2024);
    expect(normalizeImportYear("2025")).toBe(2025);
    expect(normalizeImportYear("x")).toBeNull();
  });

  it("validateEntryDraft: 年月金額の境界値を検証する", () => {
    expect(validateEntryDraft({ year: 2024, month: 1, amount: 1 })).toBeNull();
    expect(validateEntryDraft({ year: 2024, month: 1, amount: 0 })).toContain("金額");
    expect(validateEntryDraft({ year: 999, month: 1, amount: 1 })).toContain("年");
    expect(validateEntryDraft({ year: 2024, month: 13, amount: 1 })).toContain("月");
    expect(validateEntryDraft({ year: 2024, month: 1, amount: Number.NaN })).toContain("金額");
  });
});
