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
