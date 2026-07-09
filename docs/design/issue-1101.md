# 設計書: e2e/post-thread の UC-POST-09,11,23 を Playwright テストとして実装する (#1101)

## 1. 目的 / 背景

`e2e/post-thread/post-thread.spec.ts` には `test.todo()` のまま残っていた 3 件がある（UC-POST-09 / UC-POST-11 / UC-POST-23）。対応する機能（コミュニティサイドバー・購読ボタン、Markdown レンダリング、コメント共有リンクの自動スクロール）はすべて実装・マージ済みだが、e2e テストが未実装のため検証範囲から漏れていた。

調査の過程で、このファイルは `import { test } from "@playwright/test"` のまま `test.todo()`（Playwright 本体には無い独自 API。`e2e/support/test.ts` の薄いラッパー経由でのみ提供される）を直接呼んでおり、**収集（collect）時に `TypeError: test.todo is not a function` で全テストがクラッシュしていた**ことを確認した（`npx playwright test` で再現）。本 Issue で 3 件の `test.todo()` をすべて `test()` に置き換えることで、この呼び出し自体がファイルから消え、副次的にクラッシュも解消される。

## 2. スコープ（やること / やらないこと）

**やること**

- UC-POST-09 / UC-POST-11 / UC-POST-23 を `test.todo()` から実テストに置き換える。
- UC-POST-09 の検証に必要な「ログイン済み状態」を作るため、開発専用バイパスログイン（`POST /api/auth/dev-login`、`server/src/routes/auth.ts` で `NODE_ENV !== "production"` のときのみ登録）を使う `e2e/helpers/devLogin.ts` を追加する。

**やらないこと（スコープ外）**

- `e2e/helpers/login.ts` / `createUser.ts` / `logout.ts` の修正。調査の結果、これらは Google-only 認証移行（#455）以前の email/password ベースの旧フローを前提にしており、`POST /api/test/users` エンドポイントが現行 server に存在しない、`/auth/logout` はクライアント側のページとして存在しない等、**現行実装と噛み合っていない（本 Issue 着手前からの既存の別問題）**。UC-POST-03/04/08 など他ユースケースがこれらを使っており影響範囲が本 Issue 外に広いため、修正は別 Issue のスコープとする。
- `e2e/helpers/createCommunity.ts` / `createPost.ts` / `createComment.ts` の `delete()` が呼ぶ管理 API（`DELETE /api/admin/communities/:id` 等）は現行 `server/src/routes/admin.ts` に未実装（`DELETE /workers/:id` のみ存在）であることも判明したが、同様に本 Issue のスコープ外とする（既存の UC-POST-01 等、他の実テストにも共通する既存事象）。
- `session` テーブル（`connect-pg-simple` 用、migration `20260606000000_add_session_table` で定義）がローカル検証環境で未作成だった事象への対応（インフラ・マイグレーション適用手順の問題であり、アプリケーションコードの不備ではない）。
- `test.todo()` 呼び出し自体を提供する `e2e/support/test.ts` ラッパーへの import 切り替え（本 Issue で対象の 3 件を `test()`化した結果、このファイルに `test.todo()` 呼び出しが 1 件も残らなくなるため、素の `@playwright/test` import のままでもクラッシュ要因が消える）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. UC-POST-09: 投稿スレッドページにコミュニティサイドバー（名前・説明・購読ボタン等）が表示され、購読ボタンが操作可能（クリックで「購読する」→「購読解除」に切り替わる）であることをテストする。
2. UC-POST-11: Markdown 記法（太字 `**text**`・箇条書き `- item`・リンク `[text](url)`）を含む post / comment 本文が装飾済み（`<strong>` / `<li>` / `<a href>`）で表示され、生の Markdown 記法がそのまま表示されないことをテストする。
3. UC-POST-23: コメントの共有リンク（`#comment-$commentId` 形式の URL）を開くと、該当コメントが画面内（ビューポート）にスクロールして表示されることをテストする。
4. 3 件とも `test.todo(` から `test(` に置き換え、`e2e/post-thread/usecases.md` の該当 UC 記述と整合していること（今回は記述済みの usecases.md と整合しており更新不要）。
5. `pnpm turbo run build|test|lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **UC-POST-09**: 同ファイル内の UC-POST-01〜10 と同じ「実バックエンド作成（`createWorker`/`createCommunity`/`createPost`）+ `page.goto`」スタイルに合わせる。サイドバーの購読ボタン（`SubscribeButton.tsx`）は `PostThreadScene.tsx` の `PostThreadSidebar` が `showSubscribe={Boolean(authUser)}` で認証済みユーザーにのみ表示するため、テストに認証済みセッションが必要。既存の `login()` ヘルパーは現行の Google-only 認証と整合しないため使わず、`server/src/routes/auth.ts` が dev/test 環境向けに公開している `POST /api/auth/dev-login`（seed 済みの dev ユーザーとしてログインする、本来 e2e 用途を想定したバイパス経路）を `page.request` 経由で叩く `devLogin(page)` ヘルパーを新設する。`page.request` は `page` と同じブラウザコンテキストの Cookie ストアを共有するため、後続の `page.goto()` はログイン済みセッションで実行される。
- **UC-POST-11**: 同じく実バックエンド作成スタイル。`MarkdownContent.tsx` は `react-markdown` で `strong`/`li`/`a` を素の HTML タグ相当（`li`/`a` は MUI `Box`/`Link` の `component` prop 経由）としてレンダリングするため、`page.locator("strong", { hasText })` / `page.locator("li", { hasText })` / `page.getByRole("link", { name })` で検証できる。生の記法が表示されないことは `page.getByText("**太字テキスト**")).not.toBeVisible()` で確認する（該当ロケータが 0 件のとき `not.toBeVisible()` は成立する。同ファイルの UC-POST-02 で既に使われている手法）。
- **UC-POST-23**: `PostThreadScene.tsx` の `useEffect` が `window.location.hash` が `#comment-` で始まるとき対応する `#comment-<id>` 要素を `scrollIntoView({ behavior: "smooth", block: "center" })` する実装になっている。この挙動を検証するため、十分な件数（15 件）のコメントを作成して対象コメントが初期ビューポート外になるようにし、`page.goto(`/posts/$id#comment-$id`)` で直接ハッシュ付き URL を開き、`expect(locator).toBeInViewport()` でスクロール後にビューポート内へ入ったことを確認する。共有ボタンのクリック → クリップボードコピー経由の URL 取得は行わず、契約上ボタンが生成するのと同じ形式の URL を直接開く形でテストする（クリップボード API 依存を避け、決定的にする）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: e2e のみ）

- `e2e/post-thread/post-thread.spec.ts`: UC-POST-09/11/23 の `test.todo()` を実テストに置き換え。
- `e2e/helpers/devLogin.ts`: 新規追加。

## 6. テスト計画（TDDで書くテスト一覧）

本 Issue は e2e テストの追加そのものが受け入れ条件であるため、追加対象は上記 3 件の `test()` 本体（`e2e/post-thread/post-thread.spec.ts`）。ローカルで Postgres + server + client（Vite dev）を起動し、実際に Playwright（chromium）で 3 件とも green になることを確認済み（`npx playwright test e2e/post-thread/post-thread.spec.ts -g "UC-POST-09|UC-POST-11|UC-POST-23"`）。

なお `e2e/` は `pnpm-workspace.yaml` に含まれておらず、`pnpm turbo run build|test|lint`（Turborepo ワークスペース単位のタスク）の対象外のため、本 Issue の変更は該当コマンドの結果に影響しない。

## 7. リスク・未決事項

- スコープに記載の通り、`login.ts`/`createUser.ts`/`logout.ts`（旧認証フロー前提）と、`createCommunity`/`createPost`/`createComment` の `delete()` が参照する管理 API の未実装（`DELETE /api/admin/communities/:id` 等が存在しない）は、e2e が CI に組み込まれていないため気付かれていなかった既存の技術的負債。UC-POST-01 等、他の多くの実バックエンドテストの成否にも影響するため、別 Issue での棚卸しを推奨する。
