# Shinkoku-Kun

白色申告向けの収支入力・集計ツールです。  
Windowsデスクトップアプリ（Tauri + React + TypeScript + SQLite）として動作します。

## 主な機能

- プロファイル切替（複数申告対象者を分離管理）
- 年・月・カテゴリ・金額の連続入力
- 明細の編集 / 削除
- カテゴリ管理（追加 / 編集 / 削除）
- カテゴリ削除時の「強制削除 / 別カテゴリへ移管」
- 月次・年次のカテゴリ別集計
- 月次 / 年次の収支（収入合計 - 支出合計）
- 既存Excel（`データシート`）からの取り込み

## ダウンロード（利用者向け）

1. GitHub の `Releases` ページを開く  
   `https://github.com/<OWNER>/<REPO>/releases`
2. 最新リリースの `Assets` から Windows インストーラ（`.exe` または `.msi`）をダウンロード
3. インストーラを実行してインストール

## 動作環境

- OS: Windows 10 / 11
- Microsoft Edge WebView2 Runtime（通常は標準搭載）

## キーボード操作（現状）

- `Alt + N`: 金額入力欄へフォーカス
- `Ctrl + Enter`: 明細登録

## データ保存先

- SQLiteファイル: `shinkoku_kun.db`
- 保存ディレクトリ（Windows）: `%APPDATA%\\io.github.re09o1v.shinkoku-kun\\`

## 開発環境セットアップ（開発者向け）

### 前提

- Node.js 20 以上
- Rust stable
- Visual Studio Build Tools（Desktop development with C++）

### 初回セットアップ

```bash
npm ci
```

### 開発起動

```bash
npm run tauri dev
```

### テスト / 品質チェック

```bash
npm run typecheck
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

### ローカルビルド

```bash
npm run tauri build
```

生成物は `src-tauri/target/release/bundle/` 配下に出力されます。

## GitHub Releases 自動配布（メンテナ向け）

このリポジトリには以下のワークフローを用意しています。

- `.github/workflows/ci.yml`
  - Push / PR 時に `typecheck + frontend test + rust test` を実行
- `.github/workflows/release-windows.yml`
  - `v*` タグ push 時に Windows インストーラをビルドして GitHub Releases に添付

### リリース手順

1. バージョン更新（`package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`）
2. 変更をコミットして push
3. タグ作成・push

```bash
git tag v0.1.0
git push origin v0.1.0
```

4. GitHub Actions の `Release Windows App` 完了後、`Releases` にインストーラが公開されます

### GitHub側の初回確認

- Actions の実行権限が有効であること
- リポジトリ設定 `Actions > General > Workflow permissions` が `Read and write permissions` であること

## 技術スタック

- Tauri 2
- React 19
- TypeScript
- SQLite (`rusqlite`)
- calamine（Excel読み込み）
