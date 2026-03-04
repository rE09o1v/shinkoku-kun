# Runner Red Summary (2026-03-05)

## Commands
- `npm test`
- `npm run typecheck`
- `cargo test`

## Result
- `npm test`: Failed（`src/domain/__tests__/ledger.test.ts` の未実装API）
- `npm run typecheck`: Failed（`src/domain/ledger.ts` の未エクスポート）
- `cargo test`: Failed（`parse_amount` が小数を丸めて受理）

## Root Cause
- domain APIの不足と、金額ルール（整数円固定）未反映。
