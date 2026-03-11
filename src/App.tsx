import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  bootstrap,
  createCategory,
  createEntry,
  createProfile,
  deleteCategoryForce,
  deleteEntries,
  deleteCategoryMigrate,
  deleteEntry,
  getMonthlySummary,
  getYearlySummary,
  importExcel,
  listEntries,
  migrateEntriesToProfile,
  saveLastSelection,
  updateCategory,
  updateEntry,
  updateProfile,
  type Category,
  type Entry,
  type ImportReport,
  type Profile,
  type Summary,
} from "./lib/api";
import { getInputCategories } from "./lib/category";
import {
  areAllEntryIdsSelected,
  reconcileSelectedEntryIds,
  toggleAllEntryIds,
  toggleSelectedEntryId,
} from "./lib/entrySelection";
import { formatYen, monthOptions, nowYear } from "./lib/format";
import { isPositiveIntegerYen, normalizeMonthInput, normalizeYearInput } from "./lib/validation";

type Toast = {
  kind: "success" | "error" | "info";
  message: string;
};

type EditingEntry = {
  id: number;
  year: string;
  month: string;
  categoryId: string;
  amount: string;
  memo: string;
};

type EditingCategory = {
  id: number;
  name: string;
  kind: "income" | "expense";
  inputEnabled: boolean;
};

function App() {
  const amountInputRef = useRef<HTMLInputElement>(null);
  const selectAllEntriesRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<Summary | null>(null);
  const [yearlySummary, setYearlySummary] = useState<Summary | null>(null);

  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState(String(nowYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const [newProfileName, setNewProfileName] = useState("");
  const [renameProfileName, setRenameProfileName] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryKind, setNewCategoryKind] = useState<"income" | "expense">("expense");
  const [newCategoryInputEnabled, setNewCategoryInputEnabled] = useState(true);
  const [editingCategory, setEditingCategory] = useState<EditingCategory | null>(null);

  const [deleteCategoryId, setDeleteCategoryId] = useState("");
  const [deleteMode, setDeleteMode] = useState<"force" | "migrate">("migrate");
  const [migrateTargetCategoryId, setMigrateTargetCategoryId] = useState("");

  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [bulkTargetProfileId, setBulkTargetProfileId] = useState("");
  const [bulkActionSaving, setBulkActionSaving] = useState(false);

  const [importPath, setImportPath] = useState("C:\\projects\\shinkoku-kun\\収支内訳.xlsx");
  const [importReplace, setImportReplace] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);

  const inputCategories = useMemo(() => getInputCategories(categories), [categories]);
  const visibleEntryIds = useMemo(() => entries.map((entry) => entry.id), [entries]);
  const selectedEntryIdSet = useMemo(() => new Set(selectedEntryIds), [selectedEntryIds]);
  const deletableCategories = useMemo(
    () => categories.filter((c) => c.id !== Number(migrateTargetCategoryId)),
    [categories, migrateTargetCategoryId],
  );
  const movableProfiles = useMemo(
    () => profiles.filter((profile) => profile.id !== selectedProfileId),
    [profiles, selectedProfileId],
  );
  const allEntriesSelected = useMemo(
    () => areAllEntryIdsSelected(selectedEntryIds, entries),
    [selectedEntryIds, entries],
  );

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    if (!selectedProfileId) {
      return;
    }
    const year = normalizeYearInput(selectedYear);
    const month = normalizeMonthInput(selectedMonth);
    if (!year || !month) {
      return;
    }
    void loadLedger(selectedProfileId, year, month);
    void saveLastSelection({
      profileId: selectedProfileId,
      year,
      month,
      categoryId: selectedCategoryId ? Number(selectedCategoryId) : null,
    });
  }, [selectedProfileId, selectedYear, selectedMonth, selectedCategoryId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        amountInputRef.current?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void handleCreateEntry();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    setSelectedEntryIds((current) => reconcileSelectedEntryIds(current, visibleEntryIds));
    setEditingEntry((current) =>
      current && visibleEntryIds.includes(current.id) ? current : null,
    );
  }, [visibleEntryIds]);

  useEffect(() => {
    setSelectedEntryIds([]);
    setBulkTargetProfileId("");
    setEditingEntry(null);
  }, [selectedProfileId, selectedYear, selectedMonth]);

  useEffect(() => {
    if (bulkTargetProfileId && !movableProfiles.some((profile) => String(profile.id) === bulkTargetProfileId)) {
      setBulkTargetProfileId("");
    }
  }, [bulkTargetProfileId, movableProfiles]);

  useEffect(() => {
    if (!selectAllEntriesRef.current) {
      return;
    }
    selectAllEntriesRef.current.indeterminate =
      selectedEntryIds.length > 0 && !allEntriesSelected;
  }, [allEntriesSelected, selectedEntryIds]);

  async function initialize() {
    setLoading(true);
    try {
      const data = await bootstrap();
      setProfiles(data.profiles);
      setCategories(data.categories);

      const profileId = data.lastSelection.profileId ?? data.profiles[0]?.id ?? null;
      setSelectedProfileId(profileId);
      setRenameProfileName(data.profiles[0]?.name ?? "");

      const year = data.lastSelection.year ?? nowYear();
      const month = data.lastSelection.month ?? new Date().getMonth() + 1;
      setSelectedYear(String(year));
      setSelectedMonth(String(month));

      const fallbackCategory = data.categories.find((c) => c.inputEnabled)?.id;
      const categoryId = data.lastSelection.categoryId ?? fallbackCategory ?? null;
      setSelectedCategoryId(categoryId ? String(categoryId) : "");

      if (profileId) {
        await loadLedger(profileId, year, month);
      }
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLedger(profileId: number, year: number, month: number) {
    try {
      const [entryRows, monthData, yearData] = await Promise.all([
        listEntries(profileId, year, month),
        getMonthlySummary(profileId, year, month),
        getYearlySummary(profileId, year),
      ]);
      setEntries(entryRows);
      setMonthlySummary(monthData);
      setYearlySummary(yearData);
    } catch (error) {
      showError(error);
    }
  }

  function showError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    setToast({ kind: "error", message });
  }

  function showSuccess(message: string) {
    setToast({ kind: "success", message });
  }

  async function handleCreateProfile() {
    const name = newProfileName.trim();
    if (!name) {
      setToast({ kind: "info", message: "プロファイル名を入力してください。" });
      return;
    }
    try {
      const profile = await createProfile(name);
      const nextProfiles = [...profiles, profile].sort((a, b) => a.name.localeCompare(b.name));
      setProfiles(nextProfiles);
      setSelectedProfileId(profile.id);
      setRenameProfileName(profile.name);
      setNewProfileName("");
      showSuccess("プロファイルを作成しました。");
    } catch (error) {
      showError(error);
    }
  }

  async function handleRenameProfile() {
    if (!selectedProfileId) {
      return;
    }
    const name = renameProfileName.trim();
    if (!name) {
      setToast({ kind: "info", message: "変更後の名前を入力してください。" });
      return;
    }
    try {
      const updated = await updateProfile(selectedProfileId, name);
      setProfiles((current) =>
        current.map((profile) => (profile.id === updated.id ? updated : profile)),
      );
      showSuccess("プロファイル名を更新しました。");
    } catch (error) {
      showError(error);
    }
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setToast({ kind: "info", message: "カテゴリ名を入力してください。" });
      return;
    }
    try {
      const created = await createCategory({
        name,
        kind: newCategoryKind,
        inputEnabled: newCategoryInputEnabled,
      });
      setCategories((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCategoryName("");
      if (!selectedCategoryId && created.inputEnabled) {
        setSelectedCategoryId(String(created.id));
      }
      showSuccess("カテゴリを追加しました。");
    } catch (error) {
      showError(error);
    }
  }

  async function handleUpdateCategory() {
    if (!editingCategory) {
      return;
    }
    try {
      const updated = await updateCategory(editingCategory.id, {
        name: editingCategory.name.trim(),
        kind: editingCategory.kind,
        inputEnabled: editingCategory.inputEnabled,
      });
      setCategories((current) =>
        current
          .map((category) => (category.id === updated.id ? updated : category))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditingCategory(null);
      showSuccess("カテゴリを更新しました。");
    } catch (error) {
      showError(error);
    }
  }

  async function handleDeleteCategory() {
    if (!deleteCategoryId) {
      return;
    }
    try {
      if (deleteMode === "force") {
        await deleteCategoryForce(Number(deleteCategoryId));
      } else {
        if (!migrateTargetCategoryId) {
          setToast({ kind: "info", message: "移管先カテゴリを選択してください。" });
          return;
        }
        await deleteCategoryMigrate(Number(deleteCategoryId), Number(migrateTargetCategoryId));
      }

      const fresh = await bootstrap();
      setCategories(fresh.categories);
      setDeleteCategoryId("");
      setMigrateTargetCategoryId("");
      if (!fresh.categories.find((c) => c.id === Number(selectedCategoryId))) {
        const fallback = fresh.categories.find((c) => c.inputEnabled)?.id;
        setSelectedCategoryId(fallback ? String(fallback) : "");
      }
      await refreshLedger();
      showSuccess("カテゴリを削除しました。");
    } catch (error) {
      showError(error);
    }
  }

  async function refreshLedger() {
    if (!selectedProfileId) {
      return;
    }
    const year = normalizeYearInput(selectedYear);
    const month = normalizeMonthInput(selectedMonth);
    if (!year || !month) {
      return;
    }
    await loadLedger(selectedProfileId, year, month);
  }

  async function handleCreateEntry() {
    if (!selectedProfileId) {
      setToast({ kind: "info", message: "プロファイルを選択してください。" });
      return;
    }
    const year = normalizeYearInput(selectedYear);
    const month = normalizeMonthInput(selectedMonth);
    const categoryId = Number(selectedCategoryId);

    if (!year || !month) {
      setToast({ kind: "info", message: "年・月を正しく入力してください。" });
      return;
    }
    if (!categoryId) {
      setToast({ kind: "info", message: "カテゴリを選択してください。" });
      return;
    }
    if (!isPositiveIntegerYen(amount)) {
      setToast({ kind: "info", message: "金額は1円以上の整数で入力してください。" });
      return;
    }
    if (saving) {
      return;
    }

    setSaving(true);
    try {
      await createEntry({
        profileId: selectedProfileId,
        year,
        month,
        categoryId,
        amount: Number(amount),
        memo,
        source: "manual",
      });
      setAmount("");
      setMemo("");
      await refreshLedger();
      amountInputRef.current?.focus();
      showSuccess("明細を登録しました。");
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  function beginEditEntry(entry: Entry) {
    setSelectedEntryIds([]);
    setBulkTargetProfileId("");
    setEditingEntry({
      id: entry.id,
      year: String(entry.year),
      month: String(entry.month),
      categoryId: String(entry.categoryId),
      amount: String(entry.amount),
      memo: entry.memo ?? "",
    });
  }

  async function handleUpdateEntry() {
    if (!editingEntry || !selectedProfileId) {
      return;
    }
    const year = normalizeYearInput(editingEntry.year);
    const month = normalizeMonthInput(editingEntry.month);
    const categoryId = Number(editingEntry.categoryId);
    if (!year || !month || !categoryId || !isPositiveIntegerYen(editingEntry.amount)) {
      setToast({ kind: "info", message: "編集内容を確認してください。" });
      return;
    }
    try {
      await updateEntry(editingEntry.id, {
        profileId: selectedProfileId,
        year,
        month,
        categoryId,
        amount: Number(editingEntry.amount),
        memo: editingEntry.memo,
        source: "manual",
      });
      setEditingEntry(null);
      await refreshLedger();
      showSuccess("明細を更新しました。");
    } catch (error) {
      showError(error);
    }
  }

  async function handleDeleteEntry(id: number) {
    try {
      await deleteEntry(id);
      await refreshLedger();
      showSuccess("明細を削除しました。");
    } catch (error) {
      showError(error);
    }
  }

  async function handleDeleteSelectedEntries() {
    if (selectedEntryIds.length === 0) {
      setToast({ kind: "info", message: "削除する明細を選択してください。" });
      return;
    }
    if (editingEntry) {
      setToast({ kind: "info", message: "編集中の明細を保存または取消してから一括操作してください。" });
      return;
    }
    if (bulkActionSaving) {
      return;
    }

    const deleteCount = selectedEntryIds.length;
    if (!window.confirm(`選択中の${deleteCount}件を削除します。よろしいですか？`)) {
      return;
    }

    setBulkActionSaving(true);
    try {
      await deleteEntries(selectedEntryIds);
      setSelectedEntryIds([]);
      setBulkTargetProfileId("");
      await refreshLedger();
      showSuccess(`${deleteCount}件の明細を削除しました。`);
    } catch (error) {
      showError(error);
    } finally {
      setBulkActionSaving(false);
    }
  }

  async function handleMoveSelectedEntries() {
    if (selectedEntryIds.length === 0) {
      setToast({ kind: "info", message: "移行する明細を選択してください。" });
      return;
    }
    if (editingEntry) {
      setToast({ kind: "info", message: "編集中の明細を保存または取消してから一括操作してください。" });
      return;
    }
    if (!selectedProfileId) {
      setToast({ kind: "info", message: "元のプロファイルを選択してください。" });
      return;
    }
    const targetProfileId = Number(bulkTargetProfileId);
    if (!targetProfileId) {
      setToast({ kind: "info", message: "移行先プロファイルを選択してください。" });
      return;
    }
    if (targetProfileId === selectedProfileId) {
      setToast({ kind: "info", message: "移行先プロファイルは現在のプロファイルと別にしてください。" });
      return;
    }
    if (bulkActionSaving) {
      return;
    }

    const moveCount = selectedEntryIds.length;
    const targetProfile = profiles.find((profile) => profile.id === targetProfileId);
    if (
      !window.confirm(
        `選択中の${moveCount}件を「${targetProfile?.name ?? "別プロファイル"}」へ移行します。よろしいですか？`,
      )
    ) {
      return;
    }

    setBulkActionSaving(true);
    try {
      await migrateEntriesToProfile(selectedEntryIds, selectedProfileId, targetProfileId);
      setSelectedEntryIds([]);
      await refreshLedger();
      setBulkTargetProfileId("");
      showSuccess(
        `${moveCount}件の明細を${targetProfile?.name ?? "別プロファイル"}へ移行しました。`,
      );
    } catch (error) {
      showError(error);
    } finally {
      setBulkActionSaving(false);
    }
  }

  async function handleImportExcel() {
    if (!importPath.trim()) {
      setToast({ kind: "info", message: "Excelファイルのパスを入力してください。" });
      return;
    }
    try {
      const result = await importExcel(importPath.trim(), importReplace);
      setImportReport(result);
      await initialize();
      showSuccess("Excel取り込みが完了しました。");
    } catch (error) {
      showError(error);
    }
  }

  if (loading) {
    return <div className="loading">読み込み中...</div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>Shinkoku-Kun</h1>
          <p>白色申告向けレシート集計ツール</p>
        </div>
        <div className="kbd-hints">
          <span>Alt+N 金額入力へ</span>
          <span>Ctrl+Enter 登録</span>
        </div>
      </header>

      {toast && (
        <div className={`toast ${toast.kind}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)}>
            閉じる
          </button>
        </div>
      )}

      <main className="layout-grid">
        <section className="panel profile-panel">
          <h2>プロファイル</h2>
          <div className="row">
            <label>
              申告対象
              <select
                value={selectedProfileId ?? ""}
                onChange={(e) => {
                  const next = Number(e.currentTarget.value);
                  setSelectedProfileId(next || null);
                  const p = profiles.find((item) => item.id === next);
                  setRenameProfileName(p?.name ?? "");
                }}
              >
                <option value="">選択してください</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="split-row">
            <label>
              新規作成
              <input
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.currentTarget.value)}
                placeholder="例: 父"
              />
            </label>
            <button type="button" onClick={() => void handleCreateProfile()}>
              追加
            </button>
          </div>

          <div className="split-row">
            <label>
              名前変更
              <input
                value={renameProfileName}
                onChange={(e) => setRenameProfileName(e.currentTarget.value)}
                placeholder="現在のプロファイル名"
              />
            </label>
            <button type="button" onClick={() => void handleRenameProfile()}>
              更新
            </button>
          </div>
        </section>

        <section className="panel entry-panel">
          <h2>連続入力</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateEntry();
            }}
          >
            <div className="entry-grid">
              <label>
                年
                <input
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.currentTarget.value)}
                  inputMode="numeric"
                />
              </label>
              <label>
                月
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.currentTarget.value)}>
                  {monthOptions().map((m) => (
                    <option key={m} value={m}>
                      {m}月
                    </option>
                  ))}
                </select>
              </label>
              <label>
                カテゴリ
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.currentTarget.value)}
                >
                  <option value="">選択してください</option>
                  {inputCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.kind === "income" ? "収入" : "支出"})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                金額
                <input
                  ref={amountInputRef}
                  value={amount}
                  onChange={(e) => setAmount(e.currentTarget.value)}
                  placeholder="整数円"
                  inputMode="numeric"
                />
              </label>
              <label className="span-2">
                メモ
                <input value={memo} onChange={(e) => setMemo(e.currentTarget.value)} />
              </label>
              <button className="primary" type="submit" disabled={saving}>
                {saving ? "登録中..." : "登録"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel summary-panel">
          <h2>収支サマリー</h2>
          <div className="summary-cards">
            <article>
              <h3>月次</h3>
              <p>収入: ¥{formatYen(monthlySummary?.incomeTotal ?? 0)}</p>
              <p>支出: ¥{formatYen(monthlySummary?.expenseTotal ?? 0)}</p>
              <p className="net">収支: ¥{formatYen(monthlySummary?.net ?? 0)}</p>
            </article>
            <article>
              <h3>年次</h3>
              <p>収入: ¥{formatYen(yearlySummary?.incomeTotal ?? 0)}</p>
              <p>支出: ¥{formatYen(yearlySummary?.expenseTotal ?? 0)}</p>
              <p className="net">収支: ¥{formatYen(yearlySummary?.net ?? 0)}</p>
            </article>
          </div>
        </section>

        <section className="panel entries-panel">
          <h2>明細</h2>
          <div className="bulk-toolbar">
            <div className="bulk-toolbar-meta">
              <label className="checkbox-label bulk-select-all">
                <input
                  ref={selectAllEntriesRef}
                  type="checkbox"
                  checked={allEntriesSelected}
                  onChange={() =>
                    setSelectedEntryIds((current) => toggleAllEntryIds(current, entries))
                  }
                  disabled={entries.length === 0 || bulkActionSaving || Boolean(editingEntry)}
                />
                すべて選択
              </label>
              <span className="bulk-count">{selectedEntryIds.length}件選択中</span>
              <span className="bulk-hint">
                {editingEntry
                  ? "編集中は一括操作を停止しています。"
                  : "表示中の明細だけが選択対象です。"}
              </span>
            </div>
            <div className="bulk-toolbar-actions">
              <label className="compact-field">
                移行先プロファイル
                <select
                  value={bulkTargetProfileId}
                  disabled={
                    selectedEntryIds.length === 0 ||
                    movableProfiles.length === 0 ||
                    bulkActionSaving ||
                    Boolean(editingEntry)
                  }
                  onChange={(e) => setBulkTargetProfileId(e.currentTarget.value)}
                >
                  <option value="">選択してください</option>
                  {movableProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="danger"
                disabled={selectedEntryIds.length === 0 || bulkActionSaving || Boolean(editingEntry)}
                onClick={() => void handleDeleteSelectedEntries()}
              >
                {bulkActionSaving ? "処理中..." : "選択分を削除"}
              </button>
              <button
                type="button"
                disabled={
                  selectedEntryIds.length === 0 ||
                  !bulkTargetProfileId ||
                  bulkActionSaving ||
                  Boolean(editingEntry)
                }
                onClick={() => void handleMoveSelectedEntries()}
              >
                {bulkActionSaving ? "処理中..." : "選択分を移行"}
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="checkbox-cell">選択</th>
                  <th>年</th>
                  <th>月</th>
                  <th>カテゴリ</th>
                  <th>金額</th>
                  <th>メモ</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isEditing = editingEntry?.id === entry.id;
                  return (
                    <tr key={entry.id}>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedEntryIdSet.has(entry.id)}
                          onChange={() =>
                            setSelectedEntryIds((current) =>
                              toggleSelectedEntryId(current, entry.id),
                            )
                          }
                          disabled={bulkActionSaving || Boolean(editingEntry)}
                        />
                      </td>
                      {isEditing ? (
                        <>
                          <td>
                            <input
                              value={editingEntry.year}
                              onChange={(e) =>
                                setEditingEntry((current) =>
                                  current ? { ...current, year: e.currentTarget.value } : null,
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={editingEntry.month}
                              onChange={(e) =>
                                setEditingEntry((current) =>
                                  current ? { ...current, month: e.currentTarget.value } : null,
                                )
                              }
                            />
                          </td>
                          <td>
                            <select
                              value={editingEntry.categoryId}
                              onChange={(e) =>
                                setEditingEntry((current) =>
                                  current ? { ...current, categoryId: e.currentTarget.value } : null,
                                )
                              }
                            >
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              value={editingEntry.amount}
                              onChange={(e) =>
                                setEditingEntry((current) =>
                                  current ? { ...current, amount: e.currentTarget.value } : null,
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={editingEntry.memo}
                              onChange={(e) =>
                                setEditingEntry((current) =>
                                  current ? { ...current, memo: e.currentTarget.value } : null,
                                )
                              }
                            />
                          </td>
                          <td className="actions">
                            <button
                              type="button"
                              disabled={bulkActionSaving}
                              onClick={() => void handleUpdateEntry()}
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              disabled={bulkActionSaving}
                              onClick={() => setEditingEntry(null)}
                            >
                              取消
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{entry.year}</td>
                          <td>{entry.month}</td>
                          <td>{entry.categoryName}</td>
                          <td>¥{formatYen(entry.amount)}</td>
                          <td>{entry.memo}</td>
                          <td className="actions">
                            <button
                              type="button"
                              disabled={bulkActionSaving}
                              onClick={() => beginEditEntry(entry)}
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              disabled={bulkActionSaving}
                              onClick={() => void handleDeleteEntry(entry.id)}
                            >
                              削除
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      表示対象の明細はありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel categories-panel">
          <h2>カテゴリ管理</h2>
          <div className="entry-grid">
            <label>
              カテゴリ名
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.currentTarget.value)}
              />
            </label>
            <label>
              種別
              <select
                value={newCategoryKind}
                onChange={(e) => setNewCategoryKind(e.currentTarget.value as "income" | "expense")}
              >
                <option value="income">収入</option>
                <option value="expense">支出</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={newCategoryInputEnabled}
                onChange={(e) => setNewCategoryInputEnabled(e.currentTarget.checked)}
              />
              新規入力で使用する
            </label>
            <button type="button" onClick={() => void handleCreateCategory()}>
              追加
            </button>
          </div>

          <div className="category-list">
            {categories.map((category) => (
              <div className="category-item" key={category.id}>
                <div>
                  <strong>{category.name}</strong>
                  <small>{category.kind === "income" ? "収入" : "支出"}</small>
                  <small>{category.inputEnabled ? "入力可" : "表示専用"}</small>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingCategory({
                      id: category.id,
                      name: category.name,
                      kind: category.kind,
                      inputEnabled: category.inputEnabled,
                    })
                  }
                >
                  編集
                </button>
              </div>
            ))}
          </div>

          {editingCategory && (
            <div className="edit-box">
              <h3>カテゴリ編集</h3>
              <div className="entry-grid">
                <label>
                  名前
                  <input
                    value={editingCategory.name}
                    onChange={(e) =>
                      setEditingCategory((current) =>
                        current ? { ...current, name: e.currentTarget.value } : null,
                      )
                    }
                  />
                </label>
                <label>
                  種別
                  <select
                    value={editingCategory.kind}
                    onChange={(e) =>
                      setEditingCategory((current) =>
                        current
                          ? { ...current, kind: e.currentTarget.value as "income" | "expense" }
                          : null,
                      )
                    }
                  >
                    <option value="income">収入</option>
                    <option value="expense">支出</option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingCategory.inputEnabled}
                    onChange={(e) =>
                      setEditingCategory((current) =>
                        current ? { ...current, inputEnabled: e.currentTarget.checked } : null,
                      )
                    }
                  />
                  新規入力で使用する
                </label>
                <button type="button" onClick={() => void handleUpdateCategory()}>
                  更新
                </button>
                <button type="button" onClick={() => setEditingCategory(null)}>
                  閉じる
                </button>
              </div>
            </div>
          )}

          <div className="delete-box">
            <h3>カテゴリ削除</h3>
            <div className="entry-grid">
              <label>
                削除対象
                <select value={deleteCategoryId} onChange={(e) => setDeleteCategoryId(e.currentTarget.value)}>
                  <option value="">選択してください</option>
                  {deletableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                モード
                <select
                  value={deleteMode}
                  onChange={(e) => setDeleteMode(e.currentTarget.value as "force" | "migrate")}
                >
                  <option value="migrate">別カテゴリへ移管</option>
                  <option value="force">強制削除</option>
                </select>
              </label>
              {deleteMode === "migrate" && (
                <label>
                  移管先
                  <select
                    value={migrateTargetCategoryId}
                    onChange={(e) => setMigrateTargetCategoryId(e.currentTarget.value)}
                  >
                    <option value="">選択してください</option>
                    {categories
                      .filter((category) => String(category.id) !== deleteCategoryId)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <button type="button" className="danger" onClick={() => void handleDeleteCategory()}>
                削除実行
              </button>
            </div>
          </div>
        </section>

        <section className="panel import-panel">
          <h2>Excel取り込み</h2>
          <div className="entry-grid">
            <label className="span-2">
              ファイルパス
              <input value={importPath} onChange={(e) => setImportPath(e.currentTarget.value)} />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={importReplace}
                onChange={(e) => setImportReplace(e.currentTarget.checked)}
              />
              既存データを置換して取り込む
            </label>
            <button type="button" onClick={() => void handleImportExcel()}>
              取り込み
            </button>
          </div>
          {importReport && (
            <div className="report-grid">
              <p>挿入: {importReport.inserted}</p>
              <p>スキップ: {importReport.skipped}</p>
              <p>除外: {importReport.excluded}</p>
              <p>駐車場代変換: {importReport.convertedParking}</p>
              <p>新規プロファイル: {importReport.profilesCreated}</p>
              <p>新規カテゴリ: {importReport.categoriesCreated}</p>
            </div>
          )}
        </section>

        <section className="panel summary-table-panel">
          <h2>カテゴリ別集計</h2>
          <div className="table-columns">
            <div>
              <h3>{selectedMonth}月</h3>
              <SummaryTable summary={monthlySummary} />
            </div>
            <div>
              <h3>{selectedYear}年</h3>
              <SummaryTable summary={yearlySummary} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryTable({ summary }: { summary: Summary | null }) {
  if (!summary) {
    return <p>データなし</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>カテゴリ</th>
          <th>種別</th>
          <th>合計</th>
        </tr>
      </thead>
      <tbody>
        {summary.items.map((item) => (
          <tr key={item.categoryId}>
            <td>{item.categoryName}</td>
            <td>{item.kind === "income" ? "収入" : "支出"}</td>
            <td>¥{formatYen(item.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default App;
