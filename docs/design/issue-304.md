# 設計書: [common] ドメインスキーマを Community/Post/Comment/Subscription へ刷新する（公共コミュニティ移行・ADR-0019/0020）(#304)

## 1. 目的 / 背景

ADR-0018（公共型ピボット）/ ADR-0019（ドメインモデル）/ ADR-0020（権限モデル）に基づき、
common パッケージのドメイン型・Zod スキーマを旧 `Message(channel)` 中心の設計から
`Community / Post / Comment / Subscription` 中心の公共コミュニティモデルへ刷新する。

この common 層の刷新が後続の server・client・バッチ実装（#305〜#307、#310）の土台となる。

## 2. スコープ（やること / やらないこと）

### やること

- `CommunitySchema` の新規実装（id / slug / name / description / synopsis / last_slot_key / created_at）
- `PostSchema` の新規実装（id / community_id / slot_key / seq / author / title / text / score / created_at）
- `CommentSchema` の新規実装（id / community_id / post_id / slot_key / seq / author / text / score / created_at）
- `SubscriptionSchema` の新規実装（user_id / community_id / created_at）
- 生成出力スキーマ `GenerationOutputSchema`（topic / posts[]）の新規実装
- 生成出力検証関数（author 既知チェック・登場制御）の実装
- `WorldStateSchema` の新規実装（summary_version / worker_states。open_prompts は廃止）
- `formatRecentLog` を Post/Comment を入力として動くよう更新
- 旧 `MessageSchema` / `MessageArraySchema` / `channel` / `board` 系の削除・置換
- index.ts からのエクスポート更新
- Vitest テストを TDD（先行テスト）で実装

### やらないこと

- server（Prisma・HTTP API）の変更
- client（UI）の変更
- 進化イベント・mood・関係値の高度化（Phase 1）
- `parent_comment_id`（コメントの多段ネスト）（将来拡張）
- score 順フィード・hot / top（Phase 1）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `CommunitySchema` が id / slug / name / description / synopsis / last_slot_key / created_at を持ち、slug（最大50）/ name（最大50）/ description（最大500）に `.max()` が設定されている
2. `PostSchema` が id / community_id / slot_key / seq / author / title / text / score / created_at を持ち、title（最大100）/ text（最大1000）に `.max()` が設定されている
3. `CommentSchema` が id / community_id / post_id / slot_key / seq / author / text / score / created_at を持ち、text（最大1000）に `.max()` が設定されている。MVP はフラット（parent_comment_id なし）
4. `SubscriptionSchema` が user_id / community_id / created_at を持つ
5. 生成出力スキーマ `GenerationOutputSchema` が `{ topic, posts: [{ id, author, title, text, comments: [{ author, text }] }] }` の形である
6. 生成出力の検証関数が author 既知チェック（指定外 worker を reject）を行い、不正を reject するテストが通る
7. `WorldStateSchema` が summary_version / worker_states（mood / 経験値 / 最終登場 / 関係値 / 進化済みフラグ）を持ち、open_prompts を持たない
8. synopsis は WorldState ではなく Community 側に持つ
9. 旧 `MessageSchema` / `SceneSchema` / `channel` / `board` 系が削除または置換されている
10. `formatRecentLog` が Post/Comment を入力として動くよう更新され、テストが緑
11. Vitest を先に書いて（TDD）、common 単体で緑 + lint + `pnpm test:repo` 緑
12. React/MUI/Express/Prisma 等は含めない（ADR-0005 境界）

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### ディレクトリ構成

```
common/src/
  domain/
    community/        # 新規
      index.ts
      community.ts    # CommunitySchema
    post/             # 新規
      index.ts
      post.ts         # PostSchema
    comment/          # 新規
      index.ts
      comment.ts      # CommentSchema
    subscription/     # 新規
      index.ts
      subscription.ts # SubscriptionSchema
    worldState/       # 新規
      index.ts
      worldState.ts   # WorldStateSchema
    generation/       # 新規
      index.ts
      generation.ts   # GenerationOutputSchema + 検証関数
    employee/         # 既存（変更なし）
    auth/             # 既存（変更なし）
    appSetting/       # 既存（変更なし）
    batchRunLog/      # 既存（変更なし）
    tokenUsageLog/    # 既存（変更なし）
    invitation/       # 既存（変更なし）
    message/          # 削除対象（互換性のため段階的に）
    channel/          # 削除対象（互換性のため段階的に）
    task/             # 既存（変更なし）
  logic/
    formatRecentLog.ts  # Post/Comment 対応に更新
    ...（他は維持）
```

### 文字列上限値（暫定）

| フィールド | 上限 |
|-----------|------|
| Community.slug | 50 |
| Community.name | 50 |
| Community.description | 500 |
| Community.synopsis | 2000 |
| Post.title | 100 |
| Post.text | 1000 |
| Comment.text | 1000 |
| Worker.author (id) | 100 |

### 生成出力スキーマの設計

```typescript
// 生成出力: Community は呼び出し側が保持するため含めない
const GenerationOutputPostCommentSchema = z.object({
  author: z.string().min(1).max(100),  // workerId のみ（人間は現れない）
  text: z.string().min(1).max(1000),
});

const GenerationOutputPostSchema = z.object({
  id: z.string().min(1),
  author: z.string().min(1).max(100),  // workerId のみ
  title: z.string().min(1).max(100),
  text: z.string().min(1).max(1000),
  comments: z.array(GenerationOutputPostCommentSchema),
});

const GenerationOutputSchema = z.object({
  topic: z.string().min(1).max(200),
  posts: z.array(GenerationOutputPostSchema).min(1),
});
```

### `formatRecentLog` の更新方針

旧: `Message[]` → `[channel] speaker: text` 形式
新: `Post[]` + `Comment[]` 混合配列 or 新型 `PostWithComments[]` → `[community_id] author: title / text` 形式

ADR-0019 に基づき、formatRecentLog は Post + Comment の直近ログを整形する。  
新しいシグネチャ:
```typescript
type RecentEntry = { community_id: string; author: string; title?: string; text: string };
formatRecentLog(entries: readonly RecentEntry[], n: number): string[]
```

旧 Message 型は互換性のため削除するが、buildRosterMessages / parseConversationMessages 等の既存ロジックは
後続の Issue（#305/#306）で置き換えるため、この Issue では common の domain スキーマ刷新と
formatRecentLog の更新に集中する。

### WorldState の設計

```typescript
const WorkerRelationSchema = z.object({
  targetWorkerId: z.string().min(1).max(100),
  value: z.number(),
});

const WorkerStateSchema = z.object({
  mood: z.string().max(100).optional(),
  experience: z.number().int().nonnegative().default(0),
  lastAppearedSlotKey: z.string().optional(),
  relations: z.array(WorkerRelationSchema).default([]),
  hasEvolved: z.boolean().default(false),
});

const WorldStateSchema = z.object({
  summaryVersion: z.number().int().nonnegative().default(0),
  workerStates: z.record(z.string(), WorkerStateSchema).default({}),
  // open_prompts は廃止（ADR-0020）
});
```

## 5. 影響範囲 / 既存への変更

### `common/`（このIssueの対象）

- 新規: domain/community, domain/post, domain/comment, domain/subscription, domain/worldState, domain/generation
- 更新: logic/formatRecentLog.ts（Post/Comment 対応）
- 削除: domain/message（旧 MessageSchema / MessageArraySchema / MessageRecordSchema / CreateChannelMessageSchema）
- 削除: domain/channel（ChannelSchema / DEFAULT_CHANNELS 等。ただし後続Issueで使う可能性があるため一旦削除）
- 更新: index.ts（新規ドメインをエクスポート、旧ドメインを削除）
- 更新: index.test.ts（新スキーマの公開APIテスト）

### `server/`（このIssueでは変更しない）

後続 Issue (#305, #306) で対応する。

### `client/`（このIssueでは変更しない）

後続 Issue (#307) で対応する。

## 6. テスト計画（TDDで書くテスト一覧）

### domain スキーマテスト

- `CommunitySchema`: 正常パース、slug/name/description の max 超過を reject
- `PostSchema`: 正常パース、title/text の max 超過を reject
- `CommentSchema`: 正常パース、text の max 超過を reject
- `SubscriptionSchema`: 正常パース
- `WorldStateSchema`: 正常パース、open_prompts なし確認

### 生成出力テスト

- `GenerationOutputSchema`: 正常パース
- `validateGenerationOutput`: 既知 workerId の author を通す
- `validateGenerationOutput`: 未知 workerId の author を reject（不正を throw または error）
- `validateGenerationOutput`: 指定外 worker が登場していないか確認

### formatRecentLog テスト

- Post/Comment の混合入力から `[community_id] author: text` 形式への整形
- n 件以下で全件返す
- n 超では末尾 n 件のみ返す

### index.ts 公開 API テスト

- 新スキーマが index からエクスポートされている

## 7. リスク・未決事項

- `channel` / `message` 系のスキーマを削除すると、server / client のビルドが壊れる可能性がある。ただし今回の scope は common のみであり、server / client の実装は後続 Issue で更新する前提。CI でのビルド確認時はcommonのみのテスト（`pnpm --filter @hatchery/common test`）で確認する。
- `buildChannelConversationPrompt` / `parseConversationMessages` / `buildRosterMessages` 等は旧 Message 型に依存しているが、後続 Issue で server/batch 側から呼ぶ関数として整理する。この Issue では common ドメイン側の刷新のみ行い、これらの logic ファイルはそのまま残す（buildRosterMessages等はserver側に移動予定）。
- ただし `index.ts` から旧 Message 系をエクスポートしなくなると、server/client の既存コードがコンパイルエラーになる。今回は **common パッケージ単体のテスト緑** を目的とし、monorepo 全体ビルドは後続 Issue で対応する。
