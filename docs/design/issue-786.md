# 設計書: votes.ts 楽観的更新フックのロールバックをテスト (#786)

## 1. 目的 / 背景

`client/src/api/votes.ts` の `useVotePost`・`useVoteComment` は onMutate で楽観的にキャッシュを更新し、
onError で元の値へロールバックする実装が存在するが、`votes.test.ts` は素の `votePost`/`voteComment`
関数（HTTP クライアント）しかテストしていない。楽観更新ロジックのバグが静かにリグレッションを引き起こす
リスクを解消する。

## 2. スコープ（やること / やらないこと）

**やること**
- `client/src/api/votes.test.ts` に `useVotePost`・`useVoteComment` フックのユニットテストを追加する
- 既存テスト（`votePost`/`voteComment` の HTTP テスト）は一切変更しない

**やらないこと**
- `votes.ts` の実装変更（既に正しく実装されている）
- ゲスト vote ガード `useGuestVoteGuard` のテスト（#777 既存テストあり）
- e2e テスト（純粋なユニットテスト追加のためユーザー可視の振る舞いは変わらない）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `useVotePost` – 楽観的更新（未 vote → up）: onMutate でキャッシュの `score +1`・`up_count +1`・`my_vote="up"` が更新される
2. `useVotePost` – 楽観的更新（up 済み → up toggle off）: `score -1`・`up_count -1`・`my_vote=null` が更新される
3. `useVotePost` – ミューテーション失敗時に onError でキャッシュが元の値へロールバックされる
4. `useVotePost` – 成功時に onSettled で `postThreadQueryKey`・`communityFeedQueryKey`・`homeFeedQueryKeyPrefix` が invalidate される
5. `useVoteComment` – 楽観的更新（未 vote → up）: キャッシュ内の対象コメントの `score +1`・`up_count +1`・`my_vote="up"` が更新される
6. `useVoteComment` – ミューテーション失敗時に onError でキャッシュが元の値へロールバックされる
7. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### テストパターン

- `renderHook` + `QueryClientProvider` ラッパーを使用（`workers.test.tsx` の `createWrapper()` パターンと同一）
- `useAuth` は `vi.spyOn(authApi, "useAuth").mockReturnValue(...)` でゲストユーザーとしてモック
- fetch は `vi.stubGlobal("fetch", vi.fn())` でスタブ
- 楽観的更新の中間状態を観測するため「ペンディング promise」を fetch モックに使用し、`waitFor` でキャッシュの変化を確認する
- QueryClient の初期状態を `queryClient.setQueryData()` で事前シードする

### 楽観的更新の delta ロジック（参照）

votes.ts 実装より:
- `prevMyVote = post.my_vote ?? null`
- `newMyVote = prevMyVote === direction ? null : direction` (toggle off / switch)
- `scoreDelta = newScoreVal - prevScoreVal` (where val: up=1, down=-1, null=0)
- `upCountDelta = (newMyVote === "up" ? 1 : 0) - (prevMyVote === "up" ? 1 : 0)`

## 5. 影響範囲

- 対象ワークスペース: **client**
- 変更ファイル: `client/src/api/votes.test.ts`（追記のみ）
- 実装ファイルへの変更: なし

## 6. テスト計画

| テスト名 | 検証内容 |
|---------|----------|
| `useVotePost` - 楽観的更新（未 vote → up） | onMutate でキャッシュ score/up_count/my_vote が更新される |
| `useVotePost` - 楽観的更新（up 済み toggle off） | toggle off: score-1, up_count-1, my_vote=null |
| `useVotePost` - 失敗時ロールバック | onError でキャッシュが初期値へ戻る |
| `useVotePost` - onSettled で queries を invalidate | communitySlug ありで全 3 キーが invalidate される |
| `useVoteComment` - 楽観的更新（未 vote → up） | onMutate でコメントキャッシュが更新される |
| `useVoteComment` - 失敗時ロールバック | onError でコメントキャッシュが初期値へ戻る |

## 7. リスク・未決事項

- `openapi.gen.ts` は生成物でコミットしないため、テスト内の型は `Post`/`Comment` の openapi 型に依存しない形（型アサーションまたは `typeof` 推論）で記述する
- `getOrCreateGuestId()` は `localStorage` を使用するが jsdom 環境で正常動作するため個別モック不要
