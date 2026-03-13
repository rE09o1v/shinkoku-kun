import { invoke } from "@tauri-apps/api/core";

export type Profile = {
  id: number;
  name: string;
};

export type Category = {
  id: number;
  name: string;
  kind: "income" | "expense";
  inputEnabled: boolean;
};

export type Entry = {
  id: number;
  profileId: number;
  year: number;
  month: number;
  categoryId: number;
  categoryName: string;
  categoryKind: "income" | "expense";
  amount: number;
  memo?: string | null;
  source: string;
};

export type SummaryItem = {
  categoryId: number;
  categoryName: string;
  kind: "income" | "expense";
  total: number;
};

export type Summary = {
  items: SummaryItem[];
  incomeTotal: number;
  expenseTotal: number;
  net: number;
};

export type LastSelection = {
  profileId?: number | null;
  year?: number | null;
  month?: number | null;
  categoryId?: number | null;
};

export type BootstrapData = {
  profiles: Profile[];
  categories: Category[];
  lastSelection: LastSelection;
};

export type ImportReport = {
  inserted: number;
  skipped: number;
  excluded: number;
  convertedParking: number;
  profilesCreated: number;
  categoriesCreated: number;
};

export type FixedCostCreateResult = {
  createdCount: number;
  skippedMonths: number[];
};

export type EntryDraft = {
  profileId: number;
  year: number;
  month: number;
  categoryId: number;
  amount: number;
  memo?: string;
  source?: string;
};

export type FixedCostDraft = {
  profileId: number;
  year: number;
  categoryId: number;
  amount: number;
  memo?: string;
  source?: string;
};

export type CategoryDraft = {
  name: string;
  kind: "income" | "expense";
  inputEnabled: boolean;
};

export async function bootstrap(): Promise<BootstrapData> {
  return invoke<BootstrapData>("bootstrap");
}

export async function createProfile(name: string): Promise<Profile> {
  return invoke<Profile>("create_profile", { name });
}

export async function updateProfile(id: number, name: string): Promise<Profile> {
  return invoke<Profile>("update_profile", { id, name });
}

export async function createCategory(draft: CategoryDraft): Promise<Category> {
  return invoke<Category>("create_category", { draft });
}

export async function updateCategory(id: number, draft: CategoryDraft): Promise<Category> {
  return invoke<Category>("update_category", { id, draft });
}

export async function deleteCategoryForce(categoryId: number): Promise<void> {
  return invoke<void>("delete_category_force", { categoryId });
}

export async function deleteCategoryMigrate(
  categoryId: number,
  targetCategoryId: number,
): Promise<void> {
  return invoke<void>("delete_category_migrate", { categoryId, targetCategoryId });
}

export async function listEntries(
  profileId: number,
  year?: number,
  month?: number,
): Promise<Entry[]> {
  return invoke<Entry[]>("list_entries", {
    profileId,
    year: year ?? null,
    month: month ?? null,
  });
}

export async function createEntry(draft: EntryDraft): Promise<Entry> {
  return invoke<Entry>("create_entry", { draft });
}

export async function createFixedCostEntries(draft: FixedCostDraft): Promise<FixedCostCreateResult> {
  return invoke<FixedCostCreateResult>("create_fixed_cost_entries", { draft });
}

export async function updateEntry(id: number, draft: EntryDraft): Promise<Entry> {
  return invoke<Entry>("update_entry", { id, draft });
}

export async function deleteEntry(id: number): Promise<void> {
  return invoke<void>("delete_entry", { id });
}

export async function deleteEntries(entryIds: number[]): Promise<void> {
  return invoke<void>("delete_entries", { entryIds });
}

export async function migrateEntriesToProfile(
  entryIds: number[],
  sourceProfileId: number,
  targetProfileId: number,
): Promise<void> {
  return invoke<void>("move_entries_to_profile", {
    entryIds,
    targetProfileId,
    sourceProfileId,
  });
}

export async function getMonthlySummary(
  profileId: number,
  year: number,
  month: number,
): Promise<Summary> {
  return invoke<Summary>("get_monthly_summary", { profileId, year, month });
}

export async function getYearlySummary(profileId: number, year: number): Promise<Summary> {
  return invoke<Summary>("get_yearly_summary", { profileId, year });
}

export async function saveLastSelection(args: {
  profileId: number;
  year: number;
  month: number;
  categoryId?: number | null;
}): Promise<void> {
  return invoke<void>("save_last_selection", { draft: args });
}

export async function importExcel(path: string, replaceExisting: boolean): Promise<ImportReport> {
  return invoke<ImportReport>("import_excel", { path, replaceExisting });
}
