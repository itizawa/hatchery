# 設計書: 管理画面からコミュニティ単位で生成を停止できるようにする (#1011)

## 1. 目的 / 背景

定時バッチは現状すべてのコミュニティに対して post / comment を生成する。
特定コミュニティの生成を一時停止したい場面（調整中・問題のある会話の凍結等）があるが、
コミュニティ削除以外に止める手段がなかった。

本 Issue では管理画面のコミュニティ編集画面でトグルにより生成を停止/再開できるようにし、
停止中のコミュニティを定時バッチ（post / comment）から除外する。

## 2. スコープ（やること / やらないこと）

### やること
- Prisma スキーマに `generationPaused Boolean @default(false)` を追加（マイグレーション含む）
- `AdminCommunitySchema` / `UpdateCommunitySchema` に `generationPaused` を追加
- `PATCH /api/admin/communities/:id` で `generationPaused` を受け付け永続化
- `toAdminCommunityResponse` に `generationPaused` を含める
- `runPostBatch` / `runCommentBatch` で paused コミュニティを除外
- 管理画面のコミュニティ編集フォームに「生成停止」MUI Switch トグルを追加
- e2e ユースケース更新

### やらないこと
- 公開 `CommunitySchema` への `generationPaused` 追加（管理者のみ）
- 停止理由の記録・操作ログ
- 自動停止（異常検知）
- 公開フィードでの停止中コミュニティ非表示

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `CommunityRecord` に `generationPaused: boolean` が追加されている
2. `UpdateCommunitySchema` で `generationPaused: boolean.optional()` が受け付けられる
3. `AdminCommunitySchema` で `generationPaused: z.boolean()` が必須フィールドとして存在する
4. `runPostBatch`: `generationPaused=true` のコミュニティ 1 件 + 稼働中 1 件のとき、稼働中にのみ post が作られ paused には作られない
5. `runCommentBatch`: 同様に paused コミュニティには comment が作られない
6. 管理画面のコミュニティ編集ページに「生成停止」Switch トグルが表示される
7. `PATCH /api/admin/communities/:id` で `generationPaused: true` を送ると DB に永続化され、レスポンスにも含まれる

## 4. 設計方針

### データモデル

```
Community.generationPaused: Boolean @default(false)
```

- `true` = 停止中（バッチ生成対象から除外）
- `false` = 稼働中（既存挙動）
- 既存レコードはマイグレーションで全件 `false`

### バッチ除外

`runPostBatch` / `runCommentBatch` の `communityRepo.list()` 後に `.filter(c => !c.generationPaused)` を適用する。

`selectTargetCommunity.selectOneCommunity` は呼び出し元が paused 除外済みのリストを渡す設計なので、
将来 runCommunityBatch から呼ばれた場合も呼び出し元でフィルタすれば整合する。

### client UI

`EditCommunityScene.tsx` に `form.Field name="generationPaused"` を追加する。
`CommunityFormFields` はCreate/Edit 共通コンポーネントのため、編集専用フィールドは `EditCommunityScene` 側に直接記述する。

## 5. 影響範囲 / 既存への変更

| 対象 | 変更内容 |
|------|---------|
| `server/prisma/schema.prisma` | Community に `generationPaused` 追加 |
| `common/src/domain/community/community.ts` | `AdminCommunitySchema` / `UpdateCommunitySchema` に追加 |
| `server/src/persistence/communityRepository.ts` | `CommunityRecord` / `UpdateCommunityRecordInput` に追加、InMemory 実装更新 |
| `server/src/persistence/prismaCommunityRepository.ts` | `toRecord` / `update` 更新 |
| `server/src/routes/admin.ts` | PATCH body から `generationPaused` を取り出し update に渡す |
| `server/src/routes/communityResponse.ts` | `toAdminCommunityResponse` に `generationPaused` を含める |
| `server/src/batch/runPostBatch.ts` | paused コミュニティをフィルタ |
| `server/src/batch/runCommentBatch.ts` | 同上 |
| `client/src/routes/EditCommunityScene.tsx` | `generationPaused` フィールド追加 |
| `e2e/admin/usecases.md` | UC-ADMIN-16 を追加 |
| `e2e/usecases.md` | admin エリアのサマリ更新 |

## 6. テスト計画（TDD で書くテスト一覧）

1. `common/src/domain/community/community.test.ts`
   - `UpdateCommunitySchema` が `generationPaused: true` を受け付ける
   - `UpdateCommunitySchema` が `generationPaused` 省略を受け付ける
   - `AdminCommunitySchema` に `generationPaused` フィールドが含まれる

2. `server/src/batch/runPostBatch.test.ts`
   - `generationPaused=true` のコミュニティが post 生成対象から除外される（稼働中のみに post が作られる）

3. `server/src/batch/runCommentBatch.test.ts`
   - `generationPaused=true` のコミュニティが comment 生成対象から除外される

## 7. リスク・未決事項

- 既存テストで `CommunityRecord` を直接構築している箇所に `generationPaused: false` の追加が必要（TypeScript エラーが出る）
- 上記は TypeScript strict モードなら型エラーで検出されるので、実装後に全件修正する
