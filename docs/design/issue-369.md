# 設計書: post/comment に down vote を追加し、Reddit 風アクションバー（up/down 投票＋シェア）にする (#369)

## 1. 目的 / 背景

ADR-0019/0020 が「down vote は持たない（ほのぼのと相反する）」としていたが、プロダクトオーナーが方針を転換し down vote を導入する。Reddit 風 UI（up/down 矢印 + 中央に単一スコア）にし、post のアクションバーに ShareButton を追加する。

ADR-0019/0020 の該当決定を supersede する ADR-0025 を追加する。

## 2. スコープ（やること / やらないこと）

やること:
- ADR-0025 追加（ADR-0019/0020 の down vote 不採用を supersede）
- Prisma `Vote` に `direction` enum フィールドを追加、マイグレーション生成
- `VoteRepository` を `vote(userId, targetType, targetId, direction)` へ変更（toggle/switch ロジック）
- server の vote エンドポイントを方向パラメータ対応に変更（既存 409 ロジック廃止）
- common に `VoteDirectionSchema` / `VoteRequestSchema` を追加
- `PostSchema` / `CommentSchema` の `score` を負数許容（`.nonnegative()` 削除）
- OpenAPI registry を更新し gen-types まで通す
- client: `VoteControl` コンポーネント（up/down + スコア）を追加
- client: `PostCard` に `ShareButton` を追加
- client: `votePost` / `voteComment` を direction 対応に更新
- TDD: server テスト・client RTL テストを追加・更新

やらないこと:
- comment 側の ShareButton 追加（post のアクションバーのみ）
- score を使った hot/top 並び替え
- down vote累積数の表示（単一スコアのみ公開）
- ADR-0019/0020 以外の既存 ADR 変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. vote エンドポイントが `{ direction: "up" | "down" }` ボディを受け付け:
   - 未投票 → up: score +1 / 未投票 → down: score -1
   - up 済み → up (toggle off): score -1 / down 済み → down (toggle off): score +1
   - up 済み → down (switch): score -2 / down 済み → up (switch): score +2
2. レスポンスに down 累積数を含まない（score のみ）
3. 未認証で 401 / 存在しない post で 404
4. VoteControl: up 矢印 + スコア + down 矢印を表示し、現在の投票状態（up/down/未投票）を視覚的に区別
5. PostCard に ShareButton が vote コントロールの右に表示される
6. `pnpm turbo run build test lint` 緑 / `pnpm typecheck` 通過

## 4. 設計方針

### VoteRepository の変更

```ts
type VoteDirection = "up" | "down";

interface VoteRepository {
  // 既存 vote を取得
  findVote(userId, targetType, targetId): Promise<VoteRecord | null>;
  // toggle/switch ロジック。scoreDelta を返す
  vote(userId, targetType, targetId, direction): Promise<{ scoreDelta: number }>;
}
```

toggle/switch ロジック:
| 既存方向 | 新方向 | 動作 | scoreDelta |
|---------|--------|------|------------|
| なし | up | 作成 | +1 |
| なし | down | 作成 | -1 |
| up | up | 削除（toggle off） | -1 |
| down | down | 削除（toggle off） | +1 |
| up | down | 更新 | -2 |
| down | up | 更新 | +2 |

### Prisma スキーマ

```prisma
enum VoteDirection {
  up
  down
}

model Vote {
  ...
  direction VoteDirection @default(up)
}
```

マイグレーションで既存レコードのデフォルトを `up` に設定。

### Score の扱い

- `Post.score` / `Comment.score` = up 数 - down 数（ネット値）
- 負数になり得る → `PostSchema` / `CommentSchema` の `.nonnegative()` を削除
- API レスポンスに down 累積数は含めない

### server API

- `POST /api/posts/:postId/vote` body: `{ direction: "up" | "down" }` (common Zod で検証)
- `POST /api/comments/:commentId/vote` body: `{ direction: "up" | "down" }`
- 409 は廃止（toggle で既存投票を扱う）

### VoteControl コンポーネント

```tsx
interface VoteControlProps {
  score: number;
  onVote: (direction: "up" | "down") => void;
  currentVote?: "up" | "down" | null;
  disabled?: boolean;
}
```

up 矢印（ArrowUpwardIcon）- score 中央表示 - down 矢印（ArrowDownwardIcon）

### PostCard の変更

- `VoteControl` コンポーネントに差し替え
- `onVote(direction)` コールバックを受け取る
- vote の右に `<ShareButton shareUrl={postUrl} shareTitle={post.title} />` を追加
- `currentVote?: "up" | "down" | null` props を追加

## 5. 影響範囲 / 既存への変更

- `common/src/domain/post/post.ts`: score の nonnegative() 削除
- `common/src/domain/comment/comment.ts`: score の nonnegative() 削除
- `common/src/domain/post/index.ts` + `common/src/domain/comment/index.ts`: VoteRequestSchema export
- `common/src/index.ts`: vote domain を追加（または post/comment に組み込み）
- `server/prisma/schema.prisma`: VoteDirection enum + direction フィールド追加
- `server/src/persistence/voteRepository.ts`: findVote + vote メソッドに変更
- `server/src/persistence/prismaVoteRepository.ts`: 同様
- `server/src/routes/posts.ts`: vote ロジック変更
- `server/src/openapi/registry.ts`: vote request schema 追加
- `client/src/api/communities.ts`: votePost/voteComment を direction 対応に
- `client/src/components/VoteControl.tsx`: 新規
- `client/src/components/UpVoteButton.tsx`: VoteControl へ内部委譲（後方互換維持）
- `client/src/components/PostCard.tsx`: VoteControl + ShareButton に変更
- `client/src/components/CommentCard.tsx`: VoteControl に変更

## 6. テスト計画

### server
- `voteRepository.test.ts`: toggle/switch の全遷移（6パターン）
- `posts.test.ts`: up/down/toggle/switch の全遷移・score の正確な変化・レスポンスに down 累積なし・未認証 401・404

### client
- `VoteControl.test.tsx`: up/down 表示・状態切り替え・down 累積非表示
- `PostCard.test.tsx`: ShareButton が vote の右に表示されること
- `communities.test.ts`: votePost/voteComment の direction 対応

## 7. リスク・未決事項

- Prisma マイグレーションは `pnpm --filter @hatchery/server db:migrate:dev` で生成（開発 DB が必要だが CI ではスキーマ検証のみ）
- 既存 up vote レコード（direction なし）には migration で `@default(up)` を設定
