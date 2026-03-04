# Memory

## 2026-03-05
- Tauri + React MVPを要件定義に沿って実装。
- 旧Excel取込ルールを固定:
  - `駐車場代 -> 交通費`
  - `収入` / `総売上` は除外
  - `売上` は取込のみ（新規入力不可）
- 金額は整数円のみで処理し、収支は `category.kind` ベースで算出。
- 8エージェントフロー成果物:
  - `docs/specs/mvp-requirements.md`
  - `docs/specs/risk-pass1.md`
  - `docs/specs/risk-pass2.md`
  - `docs/decisions/ADR-0001-ledger-rules.md`
  - `docs/testplan/mvp-testplan.md`
  - `docs/runlogs/*`
- 年入力の境界は 2000-2100 に統一。
