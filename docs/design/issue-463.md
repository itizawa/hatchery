# Issue #463 設計書: admin/account 系のサーバ状態取得を useSuspenseQuery へ移行する

親 Issue #459（client のサーバ状態取得を Suspense クエリ方式へ統一）のサブタスク 4/4。
#460（基盤・共通 `QueryBoundary`）に依存。基盤は develop にマージ済み（`client/src/components/QueryBoundary.tsx`）。

## 背景

admin/account 系のデータ取得が非 Suspense の `useQuery` で実装され、各呼び出し元コンポーネントが
`isLoading` を個別に分岐してスケルトン/ローディングを描いている。これを `useSuspenseQuery` に統一し、
ローディング/エラー分岐を `QueryBoundary`（Suspense + ErrorBoundary）へ委譲する。

## 対象（実在ファイルのみ）

Issue 本文が挙げる対象のうち、**現在の develop に存在し、かつ「クエリ取得（`useQuery`）」であるもの**を移行する。

| フック | ファイル | 種別 | 対応 |
| --- | --- | --- | --- |
| `useBotWorkers` | `client/src/api/workers.ts` | query | `useSuspenseQuery` へ |
| `useAllBotWorkers` | `client/src/api/workers.ts` | query（現在 未使用） | `useSuspenseQuery` へ |
| `useAdminSettings` | `client/src/api/admin.ts` | query | `useSuspenseQuery` へ |
| `useAdminWorkers` | `client/src/api/admin.ts` | query | `useSuspenseQuery` へ |
| `useTokenUsage` | `client/src/api/tokenUsage.ts` | query | `useSuspenseQuery` へ |
| `useBatchLogs` | `client/src/api/batchLogs.ts` | query | `useSuspenseQuery` へ |

### スコープ外（理由を明記）

- **`client/src/api/invitations.ts`**: 現在の develop に**存在しない**（過去に削除済み）。移行対象なし。
- **`WorkerImageUpload`**: 使うのは `useUploadWorkerImage`（**mutation**）のみ。クエリ移行の対象外（変更なし）。
- **`useUpdateWorker` / `useDeleteWorker` / `useCreateAdminWorker` / `useSaveAdminSetting`**: mutation。対象外。
- **`useRefreshTokenUsage` / `useRefreshBatchLogs`**: `invalidateQueries` を返すだけ。対象外。
- **`AccountScene`**: 使うサーバ状態は `authApi.useAuth()` のみで、これは #461（auth・条件付きクエリ）の担当。本 PR では触らない。
- **`WorkerTable`**: `workers` / `isLoading` を **props で受け取る純粋表示コンポーネント**。フック呼び出しなし。
  `isLoading` を渡す呼び出し元（`AdminWorkerTable`）を Suspense 化することで、`isLoading` は常に `false`
  （= 渡さない）になる。`WorkerTable` 自体のスケルトン分岐 props は他用途（将来/他箇所）に備え残す。

## 受け入れ条件 → 入出力

1. 対象フックを `useSuspenseQuery` へ移行し、戻り値 `data` が `undefined` を取らない。
   - 各 `queryFn` は従来どおり失敗時に throw する（`useSuspenseQuery` がそれを ErrorBoundary へ伝播）。
   - `data` 型は `Worker[]` / `AppSettingResponse[]` / `TokenUsageResult` / `BatchRunLog[]`（`| undefined` が消える）。
2. 呼び出し元コンポーネントから `isLoading` 分岐を除去し、`QueryBoundary` に委譲する。
   - `AdminWorkerTab`: 自前スケルトン分岐を撤去。`QueryBoundary` で包む。
   - `AdminWorkerTable`: `isLoading` を `WorkerTable` に渡さない。`QueryBoundary` で包む。
   - `SettingsScene` の `ApiTokenSettings` / `BatchLogs` / `TokenUsageTab`: 自前スケルトン分岐を撤去し
     `QueryBoundary` で包む。
3. 各対象について、成功表示 / 取得失敗時に ErrorBoundary フォールバック表示 / ローディング中に Suspense
   fallback 表示、をテストで検証する。
4. client 内で完結し client → common 一方向 import を守る。`build|test|lint` 緑。

## 設計判断

### Suspense クエリ化の境界の置き方

各「クエリを呼ぶ末端コンポーネント」を、その**呼び出し元（親）側**で `QueryBoundary` に包む。
こうすると、

- 取得待ちは `QueryBoundary` の `fallback`（各タブに合わせたスケルトン）で表示。
- 取得失敗は `QueryBoundary` の既定エラーフォールバック（「再試行」ボタン付き）で表示。
- 失敗の影響範囲が**そのタブ/領域内に閉じる**（管理画面全体が落ちない）。

具体的には:

- `AdminWorkerTab` / `AdminWorkerTable`: コンポーネントを「クエリを呼ぶ内側（`*Inner`）」と
  「`QueryBoundary` で内側を包む外側（既存と同名の export）」に分け、外側に fallback（スケルトン）を渡す。
  既存のスケルトン用 `data-testid` は fallback 側へ移し、`isLoading=true` 相当の見た目を維持する。
- `SettingsScene`: 各タブ content（`ApiTokenSettings` / `BatchLogs` / `TokenUsageTab`）を
  `QueryBoundary` で包んでから `SETTINGS_TABS` に載せる。fallback は従来のスケルトン群を流用。

### fallback の見た目（既存スケルトン data-testid の維持）

既存テスト・視覚回帰を壊さないため、ローディング時の `data-testid`
（`admin-worker-avatar-skeleton` / `worker-table-skeleton-item` / `api-token-skeleton` /
`batch-logs-skeleton` / `token-usage-skeleton`）は `QueryBoundary` の `fallback` に同じものを置く。

### `useAllBotWorkers`

現状未使用（コメントに明記）だが、受け入れ条件 1 に従い `useSuspenseQuery` 化する（型を締める）。
呼び出し元が無いので UI 影響なし。

## テスト方針（TDD）

- **フック（`workers.test.ts` 等）**: 既存の `isSuccess`/`isError` ベースのアサーションを
  `useSuspenseQuery` 用に置き換える。成功時 `data` が解決すること（`waitFor(result.current.data)`）、
  失敗時に `<Suspense>`+`ErrorBoundary` で捕捉できること（boundary でラップした wrapper で検証）を確認。
- **コンポーネント（`AdminWorkerTab.test.tsx` / `AdminWorkerTable.test.tsx` / `SettingsScene.test.tsx`）**:
  - 成功: データ行が描画される。
  - 失敗: `queryFn` を失敗させると `QueryBoundary` の既定フォールバック（「再試行」）が表示される。
  - ローディング: 解決しない `queryFn` の間、`QueryBoundary` の fallback（スケルトン）が表示される。
  - フックを `vi.mock` していた既存テストは、Suspense では「data を返すモック」だけでは Suspense を
    解かないため、`useSuspenseQuery` の戻り値型（`{ data }`）を返すモックに合わせて修正する。

## ユーザー可視挙動と e2e

ローディングの見た目（スケルトン）と成功表示は維持。**取得失敗時の表示**が「無言/各タブ個別」から
「`QueryBoundary` の『再試行』ボタン付きフォールバック」に統一される（観察可能な改善）。
これに合わせ `e2e/admin/usecases.md` に「取得失敗時に再試行フォールバックが出る」ユースケースを追記する。
