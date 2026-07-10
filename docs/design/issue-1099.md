# 設計書: test: e2e/community の UC-COMM-19,23,24,26 を Playwright テストとして実装する (#1099)

## 1. 目的 / 背景

`e2e/community/community.spec.ts` に `test.todo()` のまま残っている 4 件（UC-COMM-19 / 23 / 24 / 26）を実テストに置き換える。対応する機能（共有ボタン #838・無限スクロール #881・モバイル概要表示 #883・New ラベル #935）はすべて実装・マージ済みであり、本 Issue は新機能追加ではなく **e2e カバレッジの取りこぼしを埋めるテスト追加のみ** を対象とする。

## 2. スコープ（やること / やらないこと）

**やること**:
- UC-COMM-19: コミュニティ詳細の各投稿カードに共有ボタンが表示されるテスト
- UC-COMM-23: コミュニティフィードの無限スクロールテスト
- UC-COMM-24: モバイル幅でのコミュニティ概要（description）表示テスト
- UC-COMM-26: 購読コミュニティの新着投稿への「New」ラベル表示テスト

**やらないこと**:
- 同ファイルに残る UC-COMM-30 / UC-COMM-31 の `test.todo()`（本 Issue のスコープ外・別 Issue）
- 機能実装自体の変更（既に実装済みのため）
- 本 Issue 着手中に発見した **UC-COMM-01/02/04/05/10/11 の既存の失敗**（後述「7. リスク・未決事項」参照）の修正（本 Issue とは無関係の既存問題のため対象外）

## 3. 受け入れ条件（テストに落とせる粒度）

1. UC-COMM-19: `/communities/$slug` の投稿カード（`[data-variant="list"]`）内に共有ボタンが表示され、クリックすると「URL をコピー」「X でシェア」のメニューが開き、「URL をコピー」でコピー成功通知が出て、かつクリックが投稿カード全体のリンク遷移に干渉しない（URL が変わらない）ことを検証する。
2. UC-COMM-23: 21 件以上の post があるコミュニティで、初回表示は 20 件、フィード最下部までスクロールすると 21 件目が追加表示されることを検証する。
3. UC-COMM-24: モバイル幅（375px）でコミュニティ詳細を開いたとき、コミュニティ名の下（ヘッダーの名前セクション）に description が表示されることを検証する。
4. UC-COMM-26: 購読済み・認証済みユーザーが `lastViewedAt` より後に作成された投稿を含むコミュニティを訪問したとき「New」チップが表示され、`mark-viewed` 完了後（既読化後）にチップが消えることを検証する。

## 4. 設計方針

- 既存の `community.spec.ts` のモックヘルパー（`mockUnauthenticated` / `mockAuthenticated` / `mockCommunitiesApi` / `mockCommunityFeedApi` / `mockCommunityWorkersApi` / `mockSubscriptionApi`）をそのまま再利用し、新規ヘルパーは追加しない。
- UC-COMM-19: コミュニティ詳細ページには **共有ボタンが 3 つ存在する**（コミュニティヘッダー・右サイドバー・投稿カード）ことを実装コード（`CommunityScene.tsx` / `CommunitySidebarCard.tsx` / `PostCard.tsx`）の確認と実機検証で確認した。そのため `page.getByRole("button", { name: "共有" })` のような素朴なセレクタは strict mode violation になる。投稿カードの `data-variant="list"` 属性（UC-COMM-18 で既に使われているパターン）でスコープを絞り、その中の共有ボタンだけを操作する。
- UC-COMM-23: `RootLayout.tsx` の main コンテンツ領域は `overflow: auto` の独立スクロールコンテナ（`data-scroll-restoration-id="main-content"`）であり、`window.scrollTo` ではスクロールイベントが発生しない。コンテナ要素を直接 `scrollTo` する。
- UC-COMM-24: description は「コミュニティヘッダー（常に表示）」と「右サイドバー（`md` 未満で `display:none`）」の 2 箇所に同じテキストが存在するため、`getByText` の素朴な呼び出しは strict mode violation になる。`data-testid="community-name-section"`（`CommunityHeader.tsx` に既存）でヘッダー側に絞り込む。
- UC-COMM-26: `mark-viewed` は購読中コミュニティ訪問時に自動発火し、成功すると `unread-counts` クエリが invalidate されて再フェッチされる。フルモック環境ではこの一連の流れが実ユーザー体験より大幅に速く完了し、「New」が表示される瞬間を観測できずにテストが flaky になる（実測で確認）。そこで UC-COMM-16 と同じ「レスポンス保留 → 明示的に解放」パターンを使い、`mark-viewed` のレスポンスを `Promise` で保留してから「New」が表示されていることを確認し、その後レスポンスを解放して消えることを確認する。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: なし（`common` / `server` / `client` のプロダクトコードは変更しない）
- 変更ファイル: `e2e/community/community.spec.ts`（`test.todo()` 4 件を実テストに置き換え）のみ

## 6. テスト計画（TDD）

本 Issue は「テストの実装」自体が成果物であり、対象の機能はすべて実装済みのため、通常の TDD（テストを書く→実装で赤緑）の「実装フェーズ」は存在しない。代わりに以下の手順で進めた:

1. `test.todo()` 4 件を実テスト（`test()`）に置き換える。
2. ローカルで Vite dev server + Playwright（`pnpm --filter @hatchery/client dev` + `pnpm e2e` 相当）を起動し、4 件とも green になることを実機で確認する（モックのみで完結し、実バックエンド・DB 接続は不要）。
3. 既存の `community.spec.ts` 全体を実行し、新規追加によるリグレッションが無いことを確認する（既存失敗 6 件は変更前から存在することを `git stash` で突き合わせ確認済み・後述）。
4. `pnpm turbo run build test lint` を実行し全ワークスペース緑を確認する。

## 7. リスク・未決事項

- **本 Issue と無関係の既存 e2e 失敗を発見した**: `UC-COMM-01` / `UC-COMM-02`（`/communities` 一覧でコミュニティ名テキストが list アイテムと card 見出しの 2 箇所にマッチし strict mode violation）、`UC-COMM-04` / `UC-COMM-05`（購読ボタンが 2 箇所にマッチ）、`UC-COMM-10`（共有ボタンが 3 箇所にマッチ・UC-COMM-19 と同根の問題）、`UC-COMM-11`（本文クランプ用コンテナの overflow 判定が null）。`git stash` で本 PR の変更を退避した状態でも同様に失敗することを確認済みで、**本 Issue の変更が原因ではない**。e2e は現状 CI（`pnpm turbo run build test lint`）に組み込まれておらず（`playwright.config.ts` のコメント参照）このマージのブロッカーにはならないが、別 Issue での対応を推奨する。
- e2e 実行には `pnpm install` に加え `@hatchery/common` のビルドと `server openapi` → `client gen-types` の生成が必要（いずれも生成物のためコミットしない）。CI に e2e を組み込む際はこのセットアップ手順の整備が必要（本 Issue のスコープ外、既知の課題として `playwright.config.ts` のコメントに記載済み）。
