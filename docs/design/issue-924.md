# 設計書: コミュニティのポスト一覧でvoteするとアイコン（currentVote）が楽観的更新されない (#924)

## 1. 目的 / 背景

コミュニティのポスト一覧（`/communities/:slug`・`CommunityScene.tsx`）で vote ボタンを押すと、
スコア（数値）は楽観的更新で即座に反映されるが、vote アイコンの塗りつぶし表示（`currentVote`）が
更新されない問題を修正する。

関連 PR #853（スレッドキャッシュ対応）・#872（フィードキャッシュ配線）で楽観更新の骨格は実装済み。
`votes.test.ts` でキャッシュ直接更新は検証済みだが、UI レンダリングレベルの検証が欠けており、
`CommunityScene.test.tsx` の vote 後 `aria-pressed` 変化テストが存在しない。

## 2. スコープ（やること / やらないこと）

**やること:**
- `CommunityScene.test.tsx` に vote 後の `aria-pressed` 楽観的更新テストを追加
- テスト実行により実際のバグ（もしあれば）を露出させ修正する
- `client` ワークスペースのみ変更

**やらないこと:**
- `server` / `common` への変更
- コメントへの vote（`useVoteComment`）は別 Issue 対象

## 3. 受け入れ条件

1. コミュニティのポスト一覧（`CommunityScene`）で up/down vote ボタンをクリックすると、
   API レスポンスを待たずにスコア数値・vote アイコン（solid/outline 切り替え）・
   pill 背景色が即座に更新される
2. 同じ方向に再クリックすると toggle off（アイコン outline・背景透明・スコア元の値）に楽観的更新
3. API エラー時はスコアとアイコンの両方がロールバックされる
4. `CommunityScene.test.tsx` に「vote後にアイコン状態（`aria-pressed`）が楽観的更新される」テストが追加
5. `pnpm turbo run build test lint` が緑。client ワークスペースの変更のみ

## 4. 設計方針

調査の結果、`votes.ts` の `onMutate` は `communityFeedQueryKey` を正しく更新している（`votes.test.ts` 済）。
`CommunityScene.test.tsx` には vote の UI レンダリング確認テストが存在しないため、
TDD で先にテストを書いて UI レベルでの動作を検証・確認・修正する。

テスト設計:
- MSW で `POST /api/posts/:postId/vote` を pending（未解決 Promise）にする
- キャッシュに `my_vote: null` のポストを仕込む
- up vote ボタンをクリック
- `aria-pressed="true"` が即座に（API 解決前に）セットされることを `waitFor` で確認
- スコアが +1 されていることも確認

もしテストが失敗する場合は `votes.ts` の `onMutate` のコミュニティフィード楽観更新パスか、
`CommunityScene.tsx` の `currentVote` prop 受け渡しを修正する。

## 5. 影響範囲

対象ワークスペース: **client のみ**

変更ファイル:
- `client/src/routes/CommunityScene.test.tsx`（テスト追加）
- 必要であれば `client/src/api/votes.ts` / `client/src/routes/CommunityScene.tsx` を修正

## 6. テスト計画

`CommunityScene.test.tsx` に追加するテスト:
1. `vote後に up vote アイコンが楽観的更新される（aria-pressed が true になる）`
2. `vote後に score が楽観的更新される`
3. `up 済み → 同方向クリックで toggle off（aria-pressed が false になる）`
4. `API エラー時に aria-pressed がロールバックされる`

## 7. リスク・未決事項

- テストを実行してみないと実際のバグの場所が確定しない（TDD先行で判明する）
- `navigate` モックが `CommunityScene.test.tsx` で必要になる可能性がある
