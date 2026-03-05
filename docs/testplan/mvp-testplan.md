# MVP Test Plan v1

## 目的
- 二重計上、正規化ミス、計算ズレを実装前に検知する。

## テストレイヤ
1. Unit (TS): 正規化・変換・収支計算
2. Unit (Rust): DB/集計/移管トランザクション
3. Integration (Rust command): CRUD + 集計整合

## 重点ケース
- 年/月正規化
- 駐車場代->交通費
- 収入/総売上除外
- 売上取り込み
- カテゴリ削除（強制/移管）
- プロファイル分離
- 整数円計算

## 品質ゲート
- npm test
- npm run typecheck
- cargo test
- npm run build

## 今回実行コマンド（8agents / implementerスキップ時）
1. `npm test`
2. `npm run typecheck`
3. `cargo test`
4. `npm run build`

## 合格基準
1. すべてのコマンドが終了コード `0` で完了する。
2. `npm test` は全テストが `passed` である。
3. `npm run typecheck` は型エラー `0件` である。
4. `cargo test` は失敗テスト `0件` である。
5. 実行結果のサマリーが `docs/runlogs/` に保存されている。

## 失敗時に記録すべき最小情報
1. 実行日時（JST）
2. 失敗コマンド
3. 失敗したテスト名/ファイル（わかる範囲）
4. エラーメッセージ先頭（スタックトレース全文は任意）
5. 再現コマンド
6. 一時対応または次アクション
