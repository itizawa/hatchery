# Issue #533 設計書: `client/src/api/communities.ts` のドメイン別分割

## 背景・目的

`client/src/api/communities.ts`（422 行）は名前に反して community / post / vote / feed / subscription を
1 ファイルに抱え、client/api 中で最大かつ責務過多。ファイル名と内容を一致させ、ドメイン単位に分割して
見通しと保守性を上げる（API 仕様・エンドポイントは変更しない純粋リファクタ）。

## 受け入れ条件（Issue より）

1. `communities.ts` を `posts.ts`・`votes.ts`・`feed.ts`・`subscriptions.ts` へ分割し、community 固有のものだけ `communities.ts` に残す。
2. 既存の export シンボル名・query key は維持し、外部からの import 参照を壊さない（必要なら re-export）。
3. 既存テスト（`communities.test.ts` 等）が緑のまま。分割後の各モジュールに対応するテスト配置に整理する。
4. `pnpm turbo run build test lint` が緑。client → common 一方向 import・OpenAPI 一方向フローを維持。

## 設計判断

### モジュール分割

| 新モジュール | 移設する公開シンボル |
|---|---|
| `posts.ts` | 型 `Post`/`Comment`、`postThreadQueryKey`、`fetchPostThread`、`usePostThread` |
| `votes.ts` | 型 `VoteDirection` re-export、`votePost`/`voteComment`、`useVotePost`/`useVoteComment` |
| `feed.ts` | `communityFeedQueryKey`/`homeFeedQueryKeyPrefix`/`homeFeedQueryKey`、`fetchCommunityFeed`/`fetchHomeFeedPage`、`useCommunityFeed`/`useInfiniteHomeFeed` |
| `subscriptions.ts` | `communitySubscriptionQueryKey`、`subscribeCommunity`/`unsubscribeCommunity`/`fetchSubscriptionStatus`、`useSubscribe`/`useUnsubscribe` |
| `communities.ts`（残置） | 型 `Community`/`CommunityImageKind`/`RecentWorker`、admin CRUD（`fetchAdminCommunities` 他）、公開ブラウズ（`fetchPublicCommunities`/`usePublicCommunities`）、最近のワーカー（`fetchRecentWorkers`/`useRecentWorkers`）、画像アップロード、各種 query key（`ADMIN_COMMUNITIES_QUERY_KEY` 等） |

### 後方互換（受け入れ条件 2）

- 30+ ファイルが `communities.ts` から各シンボルを import している。これらを一斉に書き換えるのは差分が大きく
  リスクが高いため、**`communities.ts` を「community 固有の実装 + 分割先 4 モジュールの barrel re-export」** とする。
  これにより既存 import は一切変更不要で、シンボル名・query key も完全に維持される。
- 共有型 `Post`/`Comment` は `posts.ts` を一次定義とし `communities.ts` で `export type` re-export。
  `VoteDirection` は `votes.ts` を一次 re-export 元とし `communities.ts` でも re-export。

### モジュール間依存

- `votes.ts` の `useVotePost`/`useVoteComment` は `postThreadQueryKey`（posts）・`communityFeedQueryKey`/`homeFeedQueryKeyPrefix`（feed）を import。
- `subscriptions.ts` の `useSubscribe`/`useUnsubscribe` は `homeFeedQueryKeyPrefix`（feed）を import。
- いずれも一方向（votes→posts/feed, subscriptions→feed）で循環なし。`communities.ts` の barrel は各モジュールに依存するが、
  各モジュールは `communities.ts` を import しないため循環しない。

### テスト配置（受け入れ条件 3）

`communities.test.ts` の各 describe を対象ドメインの新テストファイルへ移設する。

- `posts.test.ts`: `fetchPostThread`
- `votes.test.ts`: `votePost`/`voteComment`
- `feed.test.ts`: `fetchCommunityFeed`/`fetchHomeFeedPage`
- `subscriptions.test.ts`: `subscribeCommunity`/`unsubscribeCommunity`
- `communities.test.ts`: `fetchPublicCommunities`（community 固有）を残す。

各テストは分割後のモジュール（例 `./posts.js`）から直接 import し、当該モジュール単体が正しく動くことを担保する。
`communities.test.ts` 経由の barrel re-export も `fetchPublicCommunities` でカバーされる。

## スコープ外

- API 仕様変更・エンドポイント追加（Issue 明記）。
- 共通アンラップヘルパー（#2）の導入。重複削減は将来 Issue に委ねる。

## ユーザー可視の振る舞い

なし（純粋なファイル分割リファクタ）。`e2e/` 更新不要。
