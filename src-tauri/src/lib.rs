use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use calamine::{open_workbook_auto, Data, Reader};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Profile {
    id: i64,
    name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Category {
    id: i64,
    name: String,
    kind: String,
    input_enabled: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    id: i64,
    profile_id: i64,
    year: i32,
    month: i32,
    category_id: i64,
    category_name: String,
    category_kind: String,
    amount: i64,
    memo: Option<String>,
    source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SummaryItem {
    category_id: i64,
    category_name: String,
    kind: String,
    total: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Summary {
    items: Vec<SummaryItem>,
    income_total: i64,
    expense_total: i64,
    net: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LastSelection {
    profile_id: Option<i64>,
    year: Option<i32>,
    month: Option<i32>,
    category_id: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapData {
    profiles: Vec<Profile>,
    categories: Vec<Category>,
    last_selection: LastSelection,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct ImportReport {
    inserted: i64,
    skipped: i64,
    excluded: i64,
    converted_parking: i64,
    profiles_created: i64,
    categories_created: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EntryDraft {
    profile_id: i64,
    year: i32,
    month: i32,
    category_id: i64,
    amount: i64,
    memo: Option<String>,
    source: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CategoryDraft {
    name: String,
    kind: String,
    input_enabled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SelectionDraft {
    profile_id: i64,
    year: i32,
    month: i32,
    category_id: Option<i64>,
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("アプリデータディレクトリを取得できません: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("DB保存先を作成できません: {e}"))?;
    dir.push("shinkoku_kun.db");
    Ok(dir)
}

fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;
    let conn = Connection::open(path).map_err(|e| format!("DB接続に失敗しました: {e}"))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| format!("PRAGMA設定に失敗しました: {e}"))?;
    initialize_schema(&conn)?;
    seed_default_categories(&conn)?;
    Ok(conn)
}

fn initialize_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
          input_enabled INTEGER NOT NULL DEFAULT 1 CHECK(input_enabled IN (0,1)),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          category_id INTEGER NOT NULL,
          amount INTEGER NOT NULL,
          memo TEXT,
          source TEXT NOT NULL DEFAULT 'manual',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
          FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT,
          CHECK(month >= 1 AND month <= 12)
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_entries_profile_period
          ON entries(profile_id, year, month);
        CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category_id);
        "#,
    )
    .map_err(|e| format!("DB初期化に失敗しました: {e}"))
}

fn seed_default_categories(conn: &Connection) -> Result<(), String> {
    let defaults = [
        ("売上", "income", 1_i64),
        ("雑収入", "income", 1_i64),
        ("仕入高", "expense", 1_i64),
        ("外注工賃", "expense", 1_i64),
        ("荷造運賃", "expense", 1_i64),
        ("水道光熱費", "expense", 1_i64),
        ("地代家賃", "expense", 1_i64),
        ("旅費交通費", "expense", 1_i64),
        ("通信費", "expense", 1_i64),
        ("広告宣伝費", "expense", 1_i64),
        ("接待交際費", "expense", 1_i64),
        ("損害保険料", "expense", 1_i64),
        ("修繕費", "expense", 1_i64),
        ("消耗品費", "expense", 1_i64),
        ("減価償却費", "expense", 1_i64),
        ("福利厚生費", "expense", 1_i64),
        ("給料賃金", "expense", 1_i64),
        ("支払手数料", "expense", 1_i64),
        ("租税公課", "expense", 1_i64),
        ("雑費", "expense", 1_i64),
    ];

    for (name, kind, input_enabled) in defaults {
        conn.execute(
            r#"
            INSERT INTO categories(name, kind, input_enabled)
            VALUES(?1, ?2, ?3)
            ON CONFLICT(name) DO NOTHING
            "#,
            params![name, kind, input_enabled],
        )
        .map_err(|e| format!("カテゴリ初期投入に失敗しました: {e}"))?;
    }
    Ok(())
}

fn normalize_category_kind(raw: &str) -> Option<String> {
    let normalized = raw.trim().to_lowercase();
    if normalized == "income" || normalized == "expense" {
        Some(normalized)
    } else {
        None
    }
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn i64_to_bool(value: i64) -> bool {
    value == 1
}

fn validate_year_month(year: i32, month: i32) -> Result<(), String> {
    if !(2000..=2100).contains(&year) {
        return Err("年は2000〜2100で入力してください".to_string());
    }
    if !(1..=12).contains(&month) {
        return Err("月は1〜12で入力してください".to_string());
    }
    Ok(())
}

fn validate_amount(amount: i64) -> Result<(), String> {
    if amount <= 0 {
        return Err("金額は1円以上の整数で入力してください".to_string());
    }
    Ok(())
}

fn validate_manual_category_inputable(
    conn: &Connection,
    category_id: i64,
    source: &str,
) -> Result<(), String> {
    if source != "manual" {
        return Ok(());
    }

    let input_enabled: Option<i64> = conn
        .query_row(
            "SELECT input_enabled FROM categories WHERE id = ?1",
            params![category_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("カテゴリ確認に失敗しました: {e}"))?;

    match input_enabled {
        Some(1) => Ok(()),
        Some(_) => Err("このカテゴリは新規入力では選択できません".to_string()),
        None => Err("カテゴリが存在しません".to_string()),
    }
}

fn get_profiles(conn: &Connection) -> Result<Vec<Profile>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name FROM profiles ORDER BY name")
        .map_err(|e| format!("プロファイル取得に失敗しました: {e}"))?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|e| format!("プロファイル読込に失敗しました: {e}"))?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| format!("プロファイル変換に失敗しました: {e}"))?);
    }
    Ok(items)
}

fn get_categories(conn: &Connection) -> Result<Vec<Category>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, kind, input_enabled FROM categories ORDER BY kind DESC, name")
        .map_err(|e| format!("カテゴリ取得に失敗しました: {e}"))?;
    let rows = stmt
        .query_map([], |row| {
            let input_enabled: i64 = row.get(3)?;
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                input_enabled: i64_to_bool(input_enabled),
            })
        })
        .map_err(|e| format!("カテゴリ読込に失敗しました: {e}"))?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| format!("カテゴリ変換に失敗しました: {e}"))?);
    }
    Ok(items)
}

fn get_setting_i64(conn: &Connection, key: &str) -> Result<Option<i64>, String> {
    let value: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("設定値取得に失敗しました: {e}"))?;

    match value {
        Some(v) => v
            .parse::<i64>()
            .map(Some)
            .map_err(|_| format!("設定値が不正です: {key}")),
        None => Ok(None),
    }
}

fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO app_settings(key, value)
        VALUES(?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        "#,
        params![key, value],
    )
    .map_err(|e| format!("設定保存に失敗しました: {e}"))?;
    Ok(())
}

fn clear_setting(conn: &Connection, key: &str) -> Result<(), String> {
    conn.execute("DELETE FROM app_settings WHERE key = ?1", params![key])
        .map_err(|e| format!("設定削除に失敗しました: {e}"))?;
    Ok(())
}

#[tauri::command]
fn bootstrap(app: AppHandle) -> Result<BootstrapData, String> {
    let conn = open_connection(&app)?;
    let profile_id = get_setting_i64(&conn, "last_profile_id")?;
    let year = get_setting_i64(&conn, "last_year")?.map(|v| v as i32);
    let month = get_setting_i64(&conn, "last_month")?.map(|v| v as i32);
    let category_id = get_setting_i64(&conn, "last_category_id")?;

    Ok(BootstrapData {
        profiles: get_profiles(&conn)?,
        categories: get_categories(&conn)?,
        last_selection: LastSelection {
            profile_id,
            year,
            month,
            category_id,
        },
    })
}

#[tauri::command]
fn create_profile(app: AppHandle, name: String) -> Result<Profile, String> {
    let conn = open_connection(&app)?;
    let normalized = name.trim();
    if normalized.is_empty() {
        return Err("プロファイル名は必須です".to_string());
    }

    conn.execute(
        "INSERT INTO profiles(name) VALUES(?1)",
        params![normalized],
    )
    .map_err(|e| format!("プロファイル作成に失敗しました: {e}"))?;

    let id = conn.last_insert_rowid();
    Ok(Profile {
        id,
        name: normalized.to_string(),
    })
}

#[tauri::command]
fn update_profile(app: AppHandle, id: i64, name: String) -> Result<Profile, String> {
    let conn = open_connection(&app)?;
    let normalized = name.trim();
    if normalized.is_empty() {
        return Err("プロファイル名は必須です".to_string());
    }

    let affected = conn
        .execute(
            "UPDATE profiles SET name = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![normalized, id],
        )
        .map_err(|e| format!("プロファイル更新に失敗しました: {e}"))?;

    if affected == 0 {
        return Err("更新対象のプロファイルが見つかりません".to_string());
    }

    Ok(Profile {
        id,
        name: normalized.to_string(),
    })
}

#[tauri::command]
fn create_category(app: AppHandle, draft: CategoryDraft) -> Result<Category, String> {
    let conn = open_connection(&app)?;
    let normalized_name = draft.name.trim();
    if normalized_name.is_empty() {
        return Err("カテゴリ名は必須です".to_string());
    }
    let kind = normalize_category_kind(&draft.kind).ok_or("カテゴリ種別が不正です")?;
    let input_enabled = draft.input_enabled;

    conn.execute(
        "INSERT INTO categories(name, kind, input_enabled) VALUES(?1, ?2, ?3)",
        params![normalized_name, kind, bool_to_i64(input_enabled)],
    )
    .map_err(|e| format!("カテゴリ作成に失敗しました: {e}"))?;

    Ok(Category {
        id: conn.last_insert_rowid(),
        name: normalized_name.to_string(),
        kind,
        input_enabled,
    })
}

#[tauri::command]
fn update_category(app: AppHandle, id: i64, draft: CategoryDraft) -> Result<Category, String> {
    let conn = open_connection(&app)?;
    let normalized_name = draft.name.trim();
    if normalized_name.is_empty() {
        return Err("カテゴリ名は必須です".to_string());
    }
    let kind = normalize_category_kind(&draft.kind).ok_or("カテゴリ種別が不正です")?;
    let input_enabled = draft.input_enabled;

    let affected = conn
        .execute(
            r#"
            UPDATE categories
            SET name = ?1, kind = ?2, input_enabled = ?3, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?4
            "#,
            params![normalized_name, kind, bool_to_i64(input_enabled), id],
        )
        .map_err(|e| format!("カテゴリ更新に失敗しました: {e}"))?;

    if affected == 0 {
        return Err("更新対象のカテゴリが見つかりません".to_string());
    }

    Ok(Category {
        id,
        name: normalized_name.to_string(),
        kind,
        input_enabled,
    })
}

#[tauri::command]
fn delete_category_force(app: AppHandle, category_id: i64) -> Result<(), String> {
    let mut conn = open_connection(&app)?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("トランザクション開始に失敗しました: {e}"))?;

    tx.execute(
        "DELETE FROM entries WHERE category_id = ?1",
        params![category_id],
    )
    .map_err(|e| format!("カテゴリ配下明細の削除に失敗しました: {e}"))?;

    let affected = tx
        .execute("DELETE FROM categories WHERE id = ?1", params![category_id])
        .map_err(|e| format!("カテゴリ削除に失敗しました: {e}"))?;

    if affected == 0 {
        return Err("削除対象のカテゴリが見つかりません".to_string());
    }

    tx.commit()
        .map_err(|e| format!("カテゴリ削除の確定に失敗しました: {e}"))?;
    Ok(())
}

#[tauri::command]
fn delete_category_migrate(app: AppHandle, category_id: i64, target_category_id: i64) -> Result<(), String> {
    if category_id == target_category_id {
        return Err("移管先カテゴリは削除対象と別にしてください".to_string());
    }

    let mut conn = open_connection(&app)?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("トランザクション開始に失敗しました: {e}"))?;

    let target_exists: Option<i64> = tx
        .query_row(
            "SELECT id FROM categories WHERE id = ?1",
            params![target_category_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("移管先確認に失敗しました: {e}"))?;

    if target_exists.is_none() {
        return Err("移管先カテゴリが存在しません".to_string());
    }

    tx.execute(
        "UPDATE entries SET category_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE category_id = ?2",
        params![target_category_id, category_id],
    )
    .map_err(|e| format!("カテゴリ移管に失敗しました: {e}"))?;

    let affected = tx
        .execute("DELETE FROM categories WHERE id = ?1", params![category_id])
        .map_err(|e| format!("カテゴリ削除に失敗しました: {e}"))?;

    if affected == 0 {
        return Err("削除対象のカテゴリが見つかりません".to_string());
    }

    tx.commit()
        .map_err(|e| format!("カテゴリ移管の確定に失敗しました: {e}"))?;

    Ok(())
}

#[tauri::command]
fn list_entries(
    app: AppHandle,
    profile_id: i64,
    year: Option<i32>,
    month: Option<i32>,
) -> Result<Vec<Entry>, String> {
    let conn = open_connection(&app)?;

    if let Some(y) = year {
        if let Some(m) = month {
            validate_year_month(y, m)?;
        }
    }

    let (query, bind): (&str, Vec<rusqlite::types::Value>) = match (year, month) {
        (Some(y), Some(m)) => (
            r#"
            SELECT e.id, e.profile_id, e.year, e.month, e.category_id, c.name, c.kind, e.amount, e.memo, e.source
            FROM entries e
            JOIN categories c ON c.id = e.category_id
            WHERE e.profile_id = ?1 AND e.year = ?2 AND e.month = ?3
            ORDER BY e.id DESC
            "#,
            vec![profile_id.into(), y.into(), m.into()],
        ),
        (Some(y), None) => (
            r#"
            SELECT e.id, e.profile_id, e.year, e.month, e.category_id, c.name, c.kind, e.amount, e.memo, e.source
            FROM entries e
            JOIN categories c ON c.id = e.category_id
            WHERE e.profile_id = ?1 AND e.year = ?2
            ORDER BY e.month DESC, e.id DESC
            "#,
            vec![profile_id.into(), y.into()],
        ),
        (None, _) => (
            r#"
            SELECT e.id, e.profile_id, e.year, e.month, e.category_id, c.name, c.kind, e.amount, e.memo, e.source
            FROM entries e
            JOIN categories c ON c.id = e.category_id
            WHERE e.profile_id = ?1
            ORDER BY e.year DESC, e.month DESC, e.id DESC
            "#,
            vec![profile_id.into()],
        ),
    };

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("明細取得に失敗しました: {e}"))?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(bind), |row| {
            Ok(Entry {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                category_id: row.get(4)?,
                category_name: row.get(5)?,
                category_kind: row.get(6)?,
                amount: row.get(7)?,
                memo: row.get(8)?,
                source: row.get(9)?,
            })
        })
        .map_err(|e| format!("明細読込に失敗しました: {e}"))?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| format!("明細変換に失敗しました: {e}"))?);
    }
    Ok(items)
}

#[tauri::command]
fn create_entry(app: AppHandle, draft: EntryDraft) -> Result<Entry, String> {
    validate_year_month(draft.year, draft.month)?;
    validate_amount(draft.amount)?;

    let conn = open_connection(&app)?;
    let source = draft.source.unwrap_or_else(|| "manual".to_string());
    validate_manual_category_inputable(&conn, draft.category_id, &source)?;

    conn.execute(
        r#"
        INSERT INTO entries(profile_id, year, month, category_id, amount, memo, source)
        VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
        params![
            draft.profile_id,
            draft.year,
            draft.month,
            draft.category_id,
            draft.amount,
            draft.memo,
            source
        ],
    )
    .map_err(|e| format!("明細作成に失敗しました: {e}"))?;

    let id = conn.last_insert_rowid();
    get_entry_by_id(&conn, id)
}

#[tauri::command]
fn update_entry(app: AppHandle, id: i64, draft: EntryDraft) -> Result<Entry, String> {
    validate_year_month(draft.year, draft.month)?;
    validate_amount(draft.amount)?;
    let conn = open_connection(&app)?;
    let source = draft.source.unwrap_or_else(|| "manual".to_string());
    validate_manual_category_inputable(&conn, draft.category_id, &source)?;

    let affected = conn
        .execute(
            r#"
            UPDATE entries
            SET profile_id = ?1,
                year = ?2,
                month = ?3,
                category_id = ?4,
                amount = ?5,
                memo = ?6,
                source = ?7,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?8
            "#,
            params![
                draft.profile_id,
                draft.year,
                draft.month,
                draft.category_id,
                draft.amount,
                draft.memo,
                source,
                id
            ],
        )
        .map_err(|e| format!("明細更新に失敗しました: {e}"))?;

    if affected == 0 {
        return Err("更新対象の明細が見つかりません".to_string());
    }

    get_entry_by_id(&conn, id)
}

#[tauri::command]
fn delete_entry(app: AppHandle, id: i64) -> Result<(), String> {
    let conn = open_connection(&app)?;
    let affected = conn
        .execute("DELETE FROM entries WHERE id = ?1", params![id])
        .map_err(|e| format!("明細削除に失敗しました: {e}"))?;

    if affected == 0 {
        return Err("削除対象の明細が見つかりません".to_string());
    }

    Ok(())
}

fn get_entry_by_id(conn: &Connection, id: i64) -> Result<Entry, String> {
    conn.query_row(
        r#"
        SELECT e.id, e.profile_id, e.year, e.month, e.category_id, c.name, c.kind, e.amount, e.memo, e.source
        FROM entries e
        JOIN categories c ON c.id = e.category_id
        WHERE e.id = ?1
        "#,
        params![id],
        |row| {
            Ok(Entry {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                category_id: row.get(4)?,
                category_name: row.get(5)?,
                category_kind: row.get(6)?,
                amount: row.get(7)?,
                memo: row.get(8)?,
                source: row.get(9)?,
            })
        },
    )
    .map_err(|e| format!("明細取得に失敗しました: {e}"))
}

fn summarize_for_period(
    conn: &Connection,
    profile_id: i64,
    year: i32,
    month: Option<i32>,
) -> Result<Summary, String> {
    if let Some(m) = month {
        validate_year_month(year, m)?;
    } else {
        validate_year_month(year, 1)?;
    }

    let (query, bind): (&str, Vec<rusqlite::types::Value>) = match month {
        Some(m) => (
            r#"
            SELECT c.id, c.name, c.kind, SUM(e.amount)
            FROM entries e
            JOIN categories c ON c.id = e.category_id
            WHERE e.profile_id = ?1 AND e.year = ?2 AND e.month = ?3
            GROUP BY c.id, c.name, c.kind
            ORDER BY c.kind DESC, c.name
            "#,
            vec![profile_id.into(), year.into(), m.into()],
        ),
        None => (
            r#"
            SELECT c.id, c.name, c.kind, SUM(e.amount)
            FROM entries e
            JOIN categories c ON c.id = e.category_id
            WHERE e.profile_id = ?1 AND e.year = ?2
            GROUP BY c.id, c.name, c.kind
            ORDER BY c.kind DESC, c.name
            "#,
            vec![profile_id.into(), year.into()],
        ),
    };

    let mut stmt = conn
        .prepare(query)
        .map_err(|e| format!("集計クエリ作成に失敗しました: {e}"))?;

    let rows = stmt
        .query_map(rusqlite::params_from_iter(bind), |row| {
            Ok(SummaryItem {
                category_id: row.get(0)?,
                category_name: row.get(1)?,
                kind: row.get(2)?,
                total: row.get(3)?,
            })
        })
        .map_err(|e| format!("集計取得に失敗しました: {e}"))?;

    let mut items = Vec::new();
    let mut income_total = 0_i64;
    let mut expense_total = 0_i64;

    for row in rows {
        let item = row.map_err(|e| format!("集計変換に失敗しました: {e}"))?;
        if item.kind == "income" {
            income_total += item.total;
        } else {
            expense_total += item.total;
        }
        items.push(item);
    }

    Ok(Summary {
        items,
        income_total,
        expense_total,
        net: income_total - expense_total,
    })
}

#[tauri::command]
fn get_monthly_summary(app: AppHandle, profile_id: i64, year: i32, month: i32) -> Result<Summary, String> {
    let conn = open_connection(&app)?;
    summarize_for_period(&conn, profile_id, year, Some(month))
}

#[tauri::command]
fn get_yearly_summary(app: AppHandle, profile_id: i64, year: i32) -> Result<Summary, String> {
    let conn = open_connection(&app)?;
    summarize_for_period(&conn, profile_id, year, None)
}

#[tauri::command]
fn save_last_selection(app: AppHandle, draft: SelectionDraft) -> Result<(), String> {
    validate_year_month(draft.year, draft.month)?;

    let conn = open_connection(&app)?;
    set_setting(&conn, "last_profile_id", &draft.profile_id.to_string())?;
    set_setting(&conn, "last_year", &draft.year.to_string())?;
    set_setting(&conn, "last_month", &draft.month.to_string())?;
    if let Some(category_id) = draft.category_id {
        set_setting(&conn, "last_category_id", &category_id.to_string())?;
    } else {
        clear_setting(&conn, "last_category_id")?;
    }
    Ok(())
}

#[tauri::command]
fn import_excel(app: AppHandle, path: String, replace_existing: bool) -> Result<ImportReport, String> {
    let mut conn = open_connection(&app)?;
    let mut workbook = open_workbook_auto(&path)
        .map_err(|e| format!("Excelを開けませんでした: {e}"))?;

    let range = workbook
        .worksheet_range("データ")
        .map_err(|e| format!("シート 'データ' を読み込めません: {e}"))?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("トランザクション開始に失敗しました: {e}"))?;

    if replace_existing {
        tx.execute("DELETE FROM entries", [])
            .map_err(|e| format!("既存明細削除に失敗しました: {e}"))?;
        tx.execute("DELETE FROM profiles", [])
            .map_err(|e| format!("既存プロファイル削除に失敗しました: {e}"))?;
    }

    let mut report = ImportReport::default();
    let mut profile_cache: HashMap<String, i64> = HashMap::new();
    let mut category_cache: HashMap<String, i64> = HashMap::new();

    for (index, row) in range.rows().enumerate() {
        if index == 0 {
            continue;
        }

        let person = data_to_string(row.first());
        if person.is_empty() {
            report.skipped += 1;
            continue;
        }

        let year = match normalize_import_year(&data_to_string(row.get(1))) {
            Some(value) => value,
            None => {
                report.skipped += 1;
                continue;
            }
        };

        let month = match normalize_import_month(&data_to_string(row.get(2))) {
            Some(value) => value,
            None => {
                report.skipped += 1;
                continue;
            }
        };

        let category_raw = data_to_string(row.get(3));
        let category = match normalize_import_category(&category_raw) {
            Some((name, converted)) => {
                if converted {
                    report.converted_parking += 1;
                }
                name
            }
            None => {
                report.excluded += 1;
                continue;
            }
        };

        let amount = match parse_amount(row.get(4)) {
            Some(value) => value,
            None => {
                report.skipped += 1;
                continue;
            }
        };

        let profile_id = get_or_create_profile(&tx, &mut profile_cache, &person, &mut report)?;
        let category_id = get_or_create_category(&tx, &mut category_cache, &category, &mut report)?;

        tx.execute(
            r#"
            INSERT INTO entries(profile_id, year, month, category_id, amount, source)
            VALUES(?1, ?2, ?3, ?4, ?5, 'import')
            "#,
            params![profile_id, year, month, category_id, amount],
        )
        .map_err(|e| format!("インポート明細の保存に失敗しました: {e}"))?;
        report.inserted += 1;
    }

    tx.commit()
        .map_err(|e| format!("インポート確定に失敗しました: {e}"))?;

    Ok(report)
}

fn get_or_create_profile(
    tx: &rusqlite::Transaction,
    cache: &mut HashMap<String, i64>,
    name: &str,
    report: &mut ImportReport,
) -> Result<i64, String> {
    if let Some(id) = cache.get(name) {
        return Ok(*id);
    }

    let found: Option<i64> = tx
        .query_row(
            "SELECT id FROM profiles WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("プロファイル検索に失敗しました: {e}"))?;

    let id = match found {
        Some(id) => id,
        None => {
            tx.execute("INSERT INTO profiles(name) VALUES(?1)", params![name])
                .map_err(|e| format!("プロファイル作成に失敗しました: {e}"))?;
            report.profiles_created += 1;
            tx.last_insert_rowid()
        }
    };

    cache.insert(name.to_string(), id);
    Ok(id)
}

fn get_or_create_category(
    tx: &rusqlite::Transaction,
    cache: &mut HashMap<String, i64>,
    name: &str,
    report: &mut ImportReport,
) -> Result<i64, String> {
    if let Some(id) = cache.get(name) {
        return Ok(*id);
    }

    let found: Option<i64> = tx
        .query_row(
            "SELECT id FROM categories WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("カテゴリ検索に失敗しました: {e}"))?;

    let id = match found {
        Some(id) => id,
        None => {
            let kind = infer_category_kind(name);
            let input_enabled = 1;
            tx.execute(
                "INSERT INTO categories(name, kind, input_enabled) VALUES(?1, ?2, ?3)",
                params![name, kind, input_enabled],
            )
            .map_err(|e| format!("カテゴリ作成に失敗しました: {e}"))?;
            report.categories_created += 1;
            tx.last_insert_rowid()
        }
    };

    cache.insert(name.to_string(), id);
    Ok(id)
}

fn infer_category_kind(category_name: &str) -> &'static str {
    match category_name {
        "売上" | "雑収入" | "本業売上" | "出前売上" => "income",
        _ => "expense",
    }
}

fn data_to_string(cell: Option<&Data>) -> String {
    match cell {
        Some(Data::String(s)) => s.trim().to_string(),
        Some(Data::Float(f)) => {
            if (f.fract()).abs() < f64::EPSILON {
                format!("{f:.0}")
            } else {
                f.to_string()
            }
        }
        Some(Data::Int(i)) => i.to_string(),
        Some(Data::Bool(b)) => b.to_string(),
        Some(Data::DateTimeIso(s)) => s.trim().to_string(),
        Some(Data::DateTime(dt)) => dt.to_string(),
        Some(Data::DurationIso(s)) => s.trim().to_string(),
        Some(Data::Empty) | None => String::new(),
        Some(_) => String::new(),
    }
}

fn parse_amount(cell: Option<&Data>) -> Option<i64> {
    match cell {
        Some(Data::Int(i)) => {
            if *i > 0 {
                Some(*i)
            } else {
                None
            }
        }
        Some(Data::Float(f)) => {
            if (f.fract()).abs() < f64::EPSILON {
                let v = *f as i64;
                if v > 0 {
                    Some(v)
                } else {
                    None
                }
            } else {
                None
            }
        }
        Some(Data::String(s)) => {
            let normalized = s.replace(',', "").replace('円', "").trim().to_string();
            match normalized.parse::<i64>() {
                Ok(v) if v > 0 => Some(v),
                _ => None,
            }
        }
        _ => None,
    }
}

fn normalize_import_year(raw: &str) -> Option<i32> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let year = if let Some(year_part) = trimmed.strip_suffix('年') {
        let numeric = year_part.trim().parse::<i32>().ok()?;
        if (0..=99).contains(&numeric) {
            2000 + numeric
        } else {
            numeric
        }
    } else {
        let numeric = trimmed.parse::<i32>().ok()?;
        if (0..=99).contains(&numeric) {
            2000 + numeric
        } else {
            numeric
        }
    };

    if (2000..=2100).contains(&year) {
        Some(year)
    } else {
        None
    }
}

fn normalize_import_month(raw: &str) -> Option<i32> {
    let numeric = raw.trim().parse::<i32>().ok()?;
    if (1..=12).contains(&numeric) {
        Some(numeric)
    } else {
        None
    }
}

fn normalize_import_category(raw: &str) -> Option<(String, bool)> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed == "収入" || trimmed == "総売上" {
        return None;
    }
    if trimmed == "駐車場代" {
        return Some(("交通費".to_string(), true));
    }
    Some((trimmed.to_string(), false))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            create_profile,
            update_profile,
            create_category,
            update_category,
            delete_category_force,
            delete_category_migrate,
            list_entries,
            create_entry,
            update_entry,
            delete_entry,
            get_monthly_summary,
            get_yearly_summary,
            save_last_selection,
            import_excel
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn normalize_import_category_rules() {
        assert_eq!(
            normalize_import_category("駐車場代"),
            Some(("交通費".to_string(), true))
        );
        assert_eq!(normalize_import_category("収入"), None);
        assert_eq!(normalize_import_category("総売上"), None);
        assert_eq!(
            normalize_import_category("売上"),
            Some(("売上".to_string(), false))
        );
    }

    #[test]
    fn normalize_year_month_rules() {
        assert_eq!(normalize_import_year("24年"), Some(2024));
        assert_eq!(normalize_import_year("2024"), Some(2024));
        assert_eq!(normalize_import_month("1"), Some(1));
        assert_eq!(normalize_import_month("12"), Some(12));
        assert_eq!(normalize_import_month("0"), None);
        assert_eq!(normalize_import_month("13"), None);
    }

    #[test]
    fn amount_must_be_integer_yen() {
        assert_eq!(parse_amount(Some(&Data::Int(1200))), Some(1200));
        assert_eq!(
            parse_amount(Some(&Data::String("1,200円".to_string()))),
            Some(1200)
        );
        assert_eq!(parse_amount(Some(&Data::Float(1200.5))), None);
    }

    #[test]
    fn sales_category_is_input_enabled() {
        let conn = Connection::open_in_memory().expect("in memory db");
        initialize_schema(&conn).expect("schema");
        seed_default_categories(&conn).expect("seed categories");

        let (kind, input_enabled): (String, i64) = conn
            .query_row(
                "SELECT kind, input_enabled FROM categories WHERE name = '売上'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .expect("query");

        assert_eq!(kind, "income");
        assert_eq!(input_enabled, 1);
    }

    #[test]
    fn summary_invariant_income_expense_net() {
        let conn = Connection::open_in_memory().expect("in memory db");
        initialize_schema(&conn).expect("schema");
        seed_default_categories(&conn).expect("seed categories");
        conn.execute("INSERT INTO profiles(name) VALUES('父')", [])
            .expect("profile");

        let profile_id: i64 = conn
            .query_row("SELECT id FROM profiles WHERE name='父'", [], |r| r.get(0))
            .expect("profile id");
        let income_id: i64 = conn
            .query_row("SELECT id FROM categories WHERE name='売上'", [], |r| r.get(0))
            .expect("income id");
        let expense_id: i64 = conn
            .query_row("SELECT id FROM categories WHERE name='旅費交通費'", [], |r| {
                r.get(0)
            })
            .expect("expense id");

        conn.execute(
            "INSERT INTO entries(profile_id, year, month, category_id, amount, source) VALUES(?1, 2024, 1, ?2, 100000, 'manual')",
            params![profile_id, income_id],
        )
        .expect("insert income");
        conn.execute(
            "INSERT INTO entries(profile_id, year, month, category_id, amount, source) VALUES(?1, 2024, 1, ?2, 30000, 'manual')",
            params![profile_id, expense_id],
        )
        .expect("insert expense");

        let summary = summarize_for_period(&conn, profile_id, 2024, Some(1)).expect("summary");
        assert_eq!(summary.income_total, 100000);
        assert_eq!(summary.expense_total, 30000);
        assert_eq!(summary.net, 70000);
    }
}
