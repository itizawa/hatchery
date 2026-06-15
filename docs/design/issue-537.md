# 設計書: Issue #537 — Employee→Worker リネーム後の未使用後方互換エクスポート削除

## 背景

#329（Employee→Worker 全層リネーム）の移行用に残した後方互換エクスポートが、どこからも参照されないまま残存している。死蔵コードは誤用・混乱の原因になるため除去する。

## 削除対象（外部参照ゼロを確認済み）

1. `common/src/domain/worker/worker.ts:72` の `export type Employee = Worker;`（型 alias）
2. `client/src/api/admin.ts` の `@deprecated` な `*Employee*` エクスポート群 8 個:
   - `ADMIN_EMPLOYEES_QUERY_KEY`
   - `BOT_EMPLOYEES_ADMIN_QUERY_KEY`
   - `deleteEmployee`
   - `useDeleteEmployee`
   - `fetchAdminEmployees`
   - `useAdminEmployees`
   - `createAdminEmployee`
   - `useCreateAdminEmployee`

## 受け入れ条件（Issue より）

1. `common/src/domain/worker/worker.ts` の `Employee` 型 alias を削除する。
2. `client/src/api/admin.ts` の `@deprecated` な `*Employee*` エクスポート群（8 個）を削除する。
3. 削除後に参照切れが無いこと（`pnpm turbo run build typecheck` が緑）。
4. `pnpm turbo run build test lint` が緑。

## 設計判断

- **スコープ厳守**: Issue の受け入れ条件は worker.ts では `Employee` 型 alias 1 件のみを対象とする。worker.ts に残る他の `@deprecated` 後方互換エクスポート（`EmployeeSchema` / `UpdateEmployeeSchema` / `CreateEmployeeSchema` / `DEFAULT_EMPLOYEES` / `EMPLOYEE_*_MAX_LENGTH` / `formatEmployeeDisplayName` 等）は受け入れ条件に列挙されておらず、本 Issue のスコープ外として残す（過剰削除を避ける）。`admin.ts` 側は列挙された 8 個すべてを削除する。
- **参照切れ無しの確認**: 削除対象の各シンボルについて、リポジトリ全体（`common/src`・`server/src`・`client/src`・`tests`・`e2e`）で grep し、定義行以外のヒットが 0 であることを確認済み。よって削除しても参照切れは発生しない。
- **コメント見出しの扱い**: admin.ts の 8 個はその直前の「後方互換エクスポート」見出しコメントが囲うブロックの全要素である。8 個削除後はブロックが空になるため見出しコメントも合わせて除去する。worker.ts は他の互換エクスポートが残るため見出しコメントは残す。

## TDD 方針

リポジトリ規約テスト `tests/worker-naming.test.ts`（`pnpm test:repo` で実行）に、削除対象シンボルの「export 定義が存在しないこと」を検査する describe を追加する。

- まずテストを追加 → `Employee` 型 alias / admin.ts の 8 export が存在するため **失敗** を確認 → コミット。
- 次に worker.ts / admin.ts から該当 export を削除 → テスト緑。

検査は文字列照合の取りこぼしを避けるため、各シンボルの `export ... <Name>` 宣言パターンに対して行う。

## ユーザー可視の振る舞い

なし（未使用の内部エクスポート削除のみ）。e2e ユースケース更新は不要。
