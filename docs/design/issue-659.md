# Issue #659 設計書: Employee→Worker リネーム後の廃止済み後方互換エクスポートを削除する

## 背景

Worker リネーム（#329）対応時に追加した `@deprecated` マークの後方互換エクスポートが残存している。
Issue 本文の事前調査（grep）で主要ソースディレクトリ内での利用実績がないことが確認済み。

## 現状調査結果

### 実際に残存するEmployee後方互換エクスポート

| ファイル | 残存内容 |
|---|---|
| `common/src/domain/worker/worker.ts` 107行目以降 | `EmployeeSchema`・`Employee`型・`UpdateEmployeeSchema`・`UpdateEmployeeInput`・`CreateEmployeeSchema`・`CreateEmployeeInput`・`DEFAULT_EMPLOYEES`・`EMPLOYEE_DISPLAY_NAME_MAX_LENGTH`・`EMPLOYEE_ROLE_MAX_LENGTH`・`EMPLOYEE_IMAGE_URL_MAX_LENGTH`・`formatEmployeeDisplayName`・`createWorkerDisplayNameResolver`・`createWorkerAvatarUrlResolver` |

### 既に削除済みの対象

- `common/src/constants/workerMessages.ts` — ファイル自体が存在しない（#539 で削除済み）
- `client/src/api/admin.ts` — Employee関連エクスポートは既に存在しない（削除済み）

### テスト状況

`tests/worker-naming.test.ts` の `Issue #537` ブロック（171行目〜189行目）が今回の削除対象を検証している。
現在テストは「削除されている」ことを期待しているが、`worker.ts` にはまだ残存している。
→ `worker.ts` からEmployee後方互換エクスポートを削除することでテストが全通過する。

## 変更方針

### 削除対象

**`common/src/domain/worker/worker.ts`**
- 107行目〜131行目の後方互換エクスポートブロックを丸ごと削除

### テスト修正

`tests/worker-naming.test.ts` はテスト内容は変更不要（削除後に自然にパスする）。
ただし `ADMIN_EMPLOYEES_QUERY_KEY` 等の `client/src/api/admin.ts` 向けテストは既に削除済みのためパス済み。

## 受け入れ条件との対応

1. 上記3ファイルから `@deprecated` マークの Employee* エクスポートを削除 → `worker.ts` のみ変更（他2ファイルは既に削除済み）
2. `pnpm typecheck` 通過 → Worker向けの正エクスポートを使用する実装に影響しないことを確認
3. Employee参照テストの修正 → 既存テストは削除後に自然にパス
4. `pnpm turbo run build test lint` 緑確認
5. 変更対象ワークスペース: common（client・serverは変更不要）

## 実装手順

1. `common/src/domain/worker/worker.ts` 107行目以降の後方互換エクスポートブロックを削除
2. `pnpm typecheck` で型エラーがないことを確認
3. `pnpm turbo run build test lint` で緑確認
