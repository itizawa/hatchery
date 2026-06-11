# 設計書: Issue #393 Playwright e2e テスト基盤の整備（usecases.md + test.todo() スケルトン）

- 関連 Issue: #393
- ブランチ: `feature/issue-393`

## 目的

Playwright による e2e テスト基盤と、機能エリアごとのユースケース定義（`usecases.md`）・スケルトンテスト（`test.todo()`）を整備し、以降の e2e テスト実装（個別 Issue）を段階的に進められる状態にする。

## 設計判断

### 1. 配置: リポジトリルートの `e2e/` + ルート `playwright.config.ts`

- e2e テストは「client の UI + server の API + DB」を貫通して検証するもので、特定ワークスペースの内部品ではない。client 配下に置くと「client → server の依存はない」という見かけ上の境界が曖昧になるため、ワークスペース外（リポジトリルート）に置く。
- `playwright.config.ts` は `testDir: "./e2e"` とし、Playwright のデフォルト収集（`**/*.spec.ts`）で全サブディレクトリの spec を自動収集する（受け入れ条件 1）。
- `@playwright/test` と `e2e` スクリプトはルート `package.json` の devDependencies / scripts に追加する（受け入れ条件 5・6）。

### 2. usecases.md と spec の 1:1 対応規約

Issue の 3 ステップフロー（AI がユースケース列挙 → 人間が MD をレビュー → AI が `test.todo()` 骨格生成 → 順次実装）を機械検証できるよう、次の規約を敷く。

- `usecases.md` のユースケース見出し: `## UC-{AREA}-{NN}: {タイトル}`（例: `## UC-AUTH-01: ログイン成功`）。
- 各ユースケースは「前提条件 / ステップ / 期待動作」を日本語で記述する（受け入れ条件 3）。
- `{area}.spec.ts` の `test.todo("UC-{AREA}-{NN}: {タイトル}")` は見出しと**文字列完全一致**で 1:1 対応させる（受け入れ条件 4）。

この規約はリポジトリ規約テスト `tests/playwright-e2e-skeleton.test.ts` で機械的に強制する（後述）。

### 3. 機能エリア（5 エリア）

| ディレクトリ | 対応画面 / API | 接頭辞 |
|---|---|---|
| `e2e/auth/` | `LoginScene.tsx`（ログイン・ログアウト） | `UC-AUTH` |
| `e2e/home-feed/` | `HomeFeedScene.tsx`（新着フィード・無限スクロール・upvote） | `UC-HOME` |
| `e2e/community/` | `CommunityBrowseScene.tsx` / `CommunityScene.tsx`（一覧・詳細・購読） | `UC-COMM` |
| `e2e/post-thread/` | `PostThreadScene.tsx`（スレッド表示・upvote） | `UC-POST` |
| `e2e/admin/` | `client/src/api/admin.ts`（Worker / 設定管理） | `UC-ADMIN` |

### 4. CI からの除外

今回のスケルトンはすべて `test.todo()`（実行対象なし）であり、CI へのブラウザインストール・サーバ起動の組み込みは別 Issue（Issue 本文のスコープ外）。よって CI の `pnpm turbo run lint test build` には e2e を組み込まず、`playwright.config.ts` 冒頭コメントにその旨を明示する（受け入れ条件 7 の但し書き対応）。

### 5. 型チェック / lint との関係

- ルート `tsc -b`（project references）は `e2e/` を参照しないため `pnpm typecheck` には影響しない。エディタ補完用に `e2e/tsconfig.json` を独立配置する（references には加えない）。
- lint は各ワークスペース内の `eslint .` で実行されるため、ルート `e2e/` は対象外。境界違反（client→server 等）の懸念は e2e がワークスペース外・HTTP 経由アクセスのみであるため発生しない。

## TDD 方針（受け入れ条件 → テスト）

実体は「設定ファイル + MD + スケルトン」の整備であるため、リポジトリ規約テスト `tests/playwright-e2e-skeleton.test.ts`（`pnpm test:repo` で実行）に受け入れ条件を落とす。

1. `playwright.config.ts` が存在し `testDir: "./e2e"` を含む。
2. `e2e/{auth,home-feed,community,post-thread,admin}/` が存在する。
3. 各エリアに `usecases.md` が存在し、`## UC-...` 見出しが 1 件以上 + 「前提条件 / ステップ / 期待動作」を含む。
4. 各エリアに `{area}.spec.ts` が存在し、`test.todo()` のタイトル集合が `usecases.md` の見出し集合と完全一致する。
5. ルート `package.json` に `e2e` スクリプト（`playwright test`）がある。
6. ルート `package.json` の devDependencies に `@playwright/test` がある。
