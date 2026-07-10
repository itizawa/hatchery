# 設計書: test: e2e/home-feed の UC-HOME-26,32,33,34 を Playwright テストとして実装する (#1100)

## 1. 目的 / 背景

`e2e/home-feed/home-feed.spec.ts` に `test.todo()` のまま残っていた 4 件（UC-HOME-26 共有ボタン表示 / UC-HOME-32 New ラベル表示 / UC-HOME-33 スクロール位置復元 / UC-HOME-34 前方遷移時の先頭表示）は、対応する機能（#838, #935, #950）がいずれも実装・マージ済みであるにもかかわらず e2e カバレッジが欠けていた。本 Issue はこれらを実テストに置き換え、`e2e/home-feed/usecases.md` の記述と実装の乖離を解消する。

## 2. スコープ（やること / やらないこと）

- やること: UC-HOME-26 / UC-HOME-32 / UC-HOME-33 / UC-HOME-34 の `test.todo()` を実テストに置き換える。
- やらないこと: 対象 4 件以外の既存テスト（UC-HOME-01 等）の修正。調査の過程で、`MOCK_POST` / `MOCK_POST_2`（同ファイル冒頭で定義、camelCase 形式）が現行の Post API スキーマ（snake_case: `community_id` / `created_at` 等）と一致しておらず、これらを使う UC-HOME-01, 02, 03, 04, 05, 06, 07, 08, 09, 11, 12, 15, 20, 23, 24, 25 が既に `develop` の時点で失敗することを確認した。これは本 Issue の受け入れ条件（対象 4 件の実装）と無関係な既存の技術的負債であり、本 Issue のスコープ外として別途 Issue 化を検討する。

## 3. 受け入れ条件（テストに落とせる粒度）

1. UC-HOME-26: ホームフィードの投稿カード（`data-variant="list"`）に共有ボタン（aria-label「共有」）が表示され、クリックすると「URL をコピー」「X でシェア」のメニュー項目が表示される。
2. UC-HOME-32:
   - 購読コミュニティの `lastViewedAt` より後に作成された投稿に「New」チップが表示される。
   - 同時刻に作成された未購読コミュニティの投稿には表示されない。
   - 未ログイン時は一切表示されない。
   - `lastViewedAt` が `null`（初回購読直後）のときも表示されない。
3. UC-HOME-33: メインコンテンツ領域（`[data-scroll-restoration-id="main-content"]`）を下方向にスクロールした状態で投稿詳細へ遷移し、ブラウザの「戻る」で戻ると、scrollTop が先頭（0）ではなくスクロールした位置付近まで復元される。
4. UC-HOME-34: ホームフィードをスクロールした状態で別画面（`/about`）へ遷移し、サイドバーの「ホーム」リンクで `/` へ前方（新規）遷移すると、scrollTop が常に 0 から表示される。

## 4. 設計方針

- 既存パターンを踏襲: 共有ボタンテストは `e2e/community/community.spec.ts` の UC-COMM-19（同機能のコミュニティ版）、New ラベルテストは UC-COMM-26（community 版）のモック構成（`**/api/subscriptions/unread-counts` を軸にした `lastViewedAt` 制御）を参考にした。
- スクロール restoration は TanStack Router の `scrollRestoration: true` + `scrollToTopSelectors: ['[data-scroll-restoration-id="main-content"]']`（`client/src/router.tsx`）が担う。テストは実装の内部状態を検証するのではなく、`<main data-scroll-restoration-id="main-content">` の `scrollTop` という観察可能な DOM 状態で UX を検証する。
- 右サイドバー（`RecentPostsSidebarCard`、#928）が同じ投稿タイトルを表示しうるため、メインリストの投稿カード見出し（`<h3>` = `getByRole("heading", ...)`）に絞り込んでロケータの strict mode 違反を避けた。
- UC-HOME-33 でスクロール後にクリックする投稿は、スクロールでビューポート外に出た先頭投稿ではなく、スクロール後もビューポート内に留まる投稿（3 番目の投稿）を選んだ。先頭投稿をクリック対象にすると Playwright の actionability チェック（要素をビューへ自動スクロール）がテスト側のスクロール位置を上書きしてしまうため。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: `e2e/` のみ（`e2e/home-feed/home-feed.spec.ts`）。プロダクトコード（client/server/common）の変更なし。
- `e2e/home-feed/usecases.md` は既存の記述で UC-HOME-26/32/33/34 の期待動作が十分詳細に書かれていたため変更不要（実装したテストと整合していることを確認済み）。

## 6. テスト計画

- `pnpm playwright test e2e/home-feed/home-feed.spec.ts -g "UC-HOME-26|UC-HOME-32|UC-HOME-33|UC-HOME-34"` で対象 4 件が緑であることを確認（ローカルで複数回実行し安定性を確認済み）。
- e2e は現状 CI に組み込まれていない（`playwright.config.ts` のコメント参照）ため、`pnpm turbo run build test lint` の緑を merge ゲートとする。

## 7. リスク・未決事項

- 前述のとおり、同ファイル内の UC-HOME-01 等 16 件は既存の mock データ形式の陳腐化により `develop` の時点で既に失敗する状態だった。本 Issue のスコープ外のため対応しないが、別途 Issue 化を推奨する。
