# Memory

## 2026-03-05
- Tauri + React MVPを要件定義に沿って実装。
- 旧Excel取込ルールを固定:
  - `駐車場代 -> 交通費`
  - `収入` / `総売上` は除外
  - `売上` は取込対象
- 金額は整数円のみで処理し、収支は `category.kind` ベースで算出。
- 8エージェントフロー成果物:
  - `docs/specs/mvp-requirements.md`
  - `docs/specs/risk-pass1.md`
  - `docs/specs/risk-pass2.md`
  - `docs/decisions/ADR-0001-ledger-rules.md`
  - `docs/testplan/mvp-testplan.md`
  - `docs/runlogs/*`
- 年入力の境界は 2000-2100 に統一。
- OSS公開向けにデフォルトカテゴリを一般的な勘定科目へ更新。
- 8agentsフローの追加運用を実施（implementer工程はユーザー指示でスキップ）。
- テスト再実行（Red/Green/Regression）を実施し、全ゲート通過を `docs/runlogs/20260305-122127-*.md` に記録。
- 8agentsフローで実装工程をスキップし、テスト実行とドキュメント整備のみを実施。
- 実行ログ:
  - `docs/runlogs/20260305-122044-8agents-test-doc-only-summary.md`
  - `docs/runlogs/20260305-122239-8agents-test-doc-maintenance-summary.md`
- 12:30 JSTに8agents（implementerスキップ）で品質ゲート再実行:
  - `npm test` / `npm run typecheck` / `cargo test` / `npm run build` 全通過
  - 公式サマリー: `docs/runlogs/20260305-123000-8agents-test-docs-summary.md`
