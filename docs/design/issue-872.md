# 設計書: fix: フィード（ホーム/コミュニティ）からの vote で楽観的更新が反映されない (#872)

## 1. 目的 / 背景

`useVotePost` の `onMutate` が `postThreadQueryKey` のみを楽観更新し、ホームフィード（`homeFeedQueryKey`）・コミュニティフィード（`communityFeedQueryKey`）のキャッシュを更新しないため、フィード画面で vote を押しても即座にフィルや up_count が変化しない。

## 2. スコープ（やること / やらないこと）

やること:
- `client/src/api/votes.ts` の `useVotePost` を修正し、`onMutate` でフィードキャッシュ（homeFeed / communityFeed）も楽観更新する
- `onError` でフィードキャッシュのロールバックを追加
- `onSuccess` でフィードキャッシュをサーバ確定値で更新
- `client/src/api/votes.test.ts` に上記に対するテストを追加

やらないこと:
- `useVoteComment` のフィードキャッシュ対応（フィード一覧にコメント vote は表示されないため不要）
- common / server の変更
- ゲストの再読み込み後 `my_vote` 復元

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `useVotePost.onMutate` が `homeFeedQueryKeyPrefix()` 配下の全キャッシュ（infinite 構造 `pages[].posts`）の対象 post を楽観更新する（toggle/switch を考慮した score/up_count/my_vote の遷移）
2. `useVotePost.onMutate` が `communityFeedQueryKey(communitySlug)` キャッシュ（`Post[]` 構造）の対象 post を楽観更新する（communitySlug が渡された場合のみ）
3. `useVotePost.onError` で homeFeedQueryKey / communityFeedQueryKey も `previous` 値にロールバックされる
4. `useVotePost.onSuccess` で homeFeedQueryKey / communityFeedQueryKey の対象 post がサーバ応答の確定値に更新される
5. 既存の postThreadQueryKey テストは変更なし
6. `pnpm turbo run test lint` が緑

## 4. 設計方針

### キャッシュ構造
- `homeFeedQueryKey`: `InfiniteData<{ posts: Post[]; nextCursor: string | null }>` = `{ pages: { posts: Post[]; nextCursor: string | null }[], pageParams: unknown[] }`
- `communityFeedQueryKey`: `Post[]`

### 実装方針
- `onMutate` 内で `queryClient.getQueriesData({ queryKey: homeFeedQueryKeyPrefix() })` を使い全 sort の home feed キャッシュを一括取得・更新
- score/up_count/my_vote の算出ロジックは既存の postThread 実装と同一（toggle off / switch 対応）
- `onMutate` の戻り値に `previousHomeFeedEntries`・`previousCommunityFeed` を追加し、`onError` でロールバック
- `onSuccess` でサーバ応答の確定値を home feed / community feed キャッシュに反映

## 5. 影響範囲 / 既存への変更

- `client/src/api/votes.ts`: `useVotePost` の onMutate / onError / onSuccess を修正
- `client/src/api/votes.test.ts`: フィードキャッシュ楽観更新テストを追加

## 6. テスト計画

- `useVotePost.onMutate: homeFeedQueryKey の post が楽観更新される（未 vote → up）`
- `useVotePost.onMutate: communityFeedQueryKey の post が楽観更新される（未 vote → up）`
- `useVotePost.onMutate: toggle off（up 済み → up）で homeFeedQueryKey の post が元に戻る方向に更新される`
- `useVotePost.onError: homeFeedQueryKey のキャッシュがロールバックされる`
- `useVotePost.onError: communityFeedQueryKey のキャッシュがロールバックされる`
- `useVotePost.onSuccess: homeFeedQueryKey の post がサーバ確定値で更新される`
- `useVotePost.onSuccess: communityFeedQueryKey の post がサーバ確定値で更新される`

## 7. リスク・未決事項

- homeFeed は infinite query で複数ページを持つ可能性があるため、全ページの対象 post を更新する必要がある（`pages.map` で対応）
- `queryClient.getQueriesData` は TanStack Query v5 で利用可能（確認済み: ^5.62.7）
