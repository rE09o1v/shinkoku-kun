export type CategoryKind = "income" | "expense";

export type LedgerCategory = {
  id: number;
  name: string;
  kind: CategoryKind;
  inputEnabled: boolean;
};

export type EntrySource = "manual" | "import";

export type LedgerEntry = {
  id: number;
  profileId: number;
  year: number;
  month: number;
  categoryId: number;
  amount: number;
  source: EntrySource;
};

export type SummaryResult = {
  categoryTotals: Map<string, number>;
  incomeTotal: number;
  expenseTotal: number;
  net: number;
};

export function summarizeEntries(
  entries: LedgerEntry[],
  categories: LedgerCategory[],
): SummaryResult {
  const categoryById = new Map<number, LedgerCategory>();
  categories.forEach((category) => categoryById.set(category.id, category));

  const categoryTotals = new Map<string, number>();
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const entry of entries) {
    const category = categoryById.get(entry.categoryId);
    if (!category) {
      continue;
    }

    const currentTotal = categoryTotals.get(category.name) ?? 0;
    categoryTotals.set(category.name, currentTotal + entry.amount);

    if (category.kind === "income") {
      incomeTotal += entry.amount;
    } else {
      expenseTotal += entry.amount;
    }
  }

  return {
    categoryTotals,
    incomeTotal,
    expenseTotal,
    net: incomeTotal - expenseTotal,
  };
}

export function normalizeImportCategory(raw: string): string | null {
  const normalized = raw.trim();
  if (!normalized) {
    return null;
  }
  if (normalized === "収入" || normalized === "総売上") {
    return null;
  }
  if (normalized === "駐車場代") {
    return "交通費";
  }
  return normalized;
}

export function normalizeImportYear(raw: string): number | null {
  const normalized = raw.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.endsWith("年")) {
    const value = Number.parseInt(normalized.slice(0, -1), 10);
    if (Number.isNaN(value)) {
      return null;
    }
    return value <= 99 ? 2000 + value : value;
  }

  const value = Number.parseInt(normalized, 10);
  if (Number.isNaN(value)) {
    return null;
  }
  const year = value <= 99 ? 2000 + value : value;
  if (year < 2000 || year > 2100) {
    return null;
  }
  return year;
}

export function normalizeImportMonth(raw: string | number): number | null {
  const value =
    typeof raw === "number"
      ? raw
      : Number.parseInt(String(raw).trim(), 10);
  if (!Number.isInteger(value)) {
    return null;
  }
  if (value < 1 || value > 12) {
    return null;
  }
  return value;
}

export function transformImportCategory(raw: string): string | null {
  return normalizeImportCategory(raw);
}

export function shouldSkipImportCategory(raw: string): boolean {
  const normalized = raw.trim();
  return normalized === "収入" || normalized === "総売上" || normalized.length === 0;
}

export type SummaryEntry = {
  amountYen: number;
  kind: CategoryKind;
};

export type NetSummary = {
  totalIncomeYen: number;
  totalExpenseYen: number;
  netYen: number;
};

export function computeNetSummary(rows: SummaryEntry[]): NetSummary {
  let totalIncomeYen = 0;
  let totalExpenseYen = 0;

  for (const row of rows) {
    if (row.kind === "income") {
      totalIncomeYen += row.amountYen;
    } else {
      totalExpenseYen += row.amountYen;
    }
  }

  return {
    totalIncomeYen,
    totalExpenseYen,
    netYen: totalIncomeYen - totalExpenseYen,
  };
}

export function validateEntryDraft(input: {
  year: number;
  month: number;
  amount: number;
}): string | null {
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    return "年は2000〜2100の4桁で入力してください";
  }
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    return "月は1〜12で入力してください";
  }
  if (
    !Number.isFinite(input.amount) ||
    !Number.isInteger(input.amount) ||
    input.amount <= 0
  ) {
    return "金額は整数円で入力してください";
  }
  return null;
}
