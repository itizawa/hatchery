# Issue #555 設計書: 定時バッチが既存Postにもコメントを追加できるようにする

## 背景・目的

現状の定時バッチは毎回まっさらな新規スレッドのみ生成する。これにより選ばれなかったコミュニティの過去Postが伸びずに放置される問題がある。

本Issueでは生成出力スキーマを拡張し、新規Post生成に加えて「既存PostへのReply（コメント追加）」も1回の生成で行えるようにする。

## 受け入れ条件の整理

1. **common `GenerationOutputSchema` 拡張**: `replies` フィールドを追加する
   - `replies: [{ targetPostRef, author, text }]`
   - `targetPostRef` と `text` は `.max()` 必須
   
2. **common `validateGenerationOutput` 拡張**: 
   - `replies` の `author` が既知 workerId であること
   - `replies` の `targetPostRef` がプロンプトに提示した既存Post参照ID集合に含まれること（knownPostRefs）
   - 未知の `targetPostRef` を含む場合はエラー（その定時はスキップ）

3. **server `buildCommunityPrompt` 拡張**:
   - 直近Postに対し安定した参照ID（postId由来の短いキー）をプロンプトに露出
   - 「既存PostにReplyを追加してよい」旨の指示を含む
   - 参照ID → 実postId のマッピングを戻り値に含める

4. **server `runCommunityBatch` 拡張**:
   - `buildCommunityPrompt` が返す参照IDマップを使って reply を実postIdに解決
   - 当該スロットの `slotKey` + フラットな `seq` で `commentRepo.createMany` により永続化
   - 新規Post + そのコメント生成は既存挙動を維持

5. **既存Postが0件の場合**: `replies` が空のまま正常動作し、新規Postのみ生成

6. **スコープ**: common / server のみ変更（client は変更しない）

## 設計判断

### GenerationOutputSchema の拡張方針

Issueでは「`replies: [{ targetPostRef, author, text }]`を追加、またはpostsと統合した判別可能ユニオン」の2案が示されているが、以下の理由でフラットな `replies` フィールド追加を採用する：

- 既存テスト・コードへの影響が最小
- 新旧フォーマットの相互互換性が保たれる（新規Post生成に影響を与えない）
- AIモデルへの指示も分離して理解しやすい

```typescript
export const GenerationOutputReplySchema = z.object({
  targetPostRef: z.string().min(1).max(50),  // プロンプトに露出した参照ID
  author: z.string().min(1).max(100),
  text: z.string().min(1).max(COMMENT_TEXT_MAX_LENGTH),
});

export const GenerationOutputSchema = z.object({
  topic: z.string().min(1).max(200),
  posts: z.array(GenerationOutputPostSchema).min(1),
  replies: z.array(GenerationOutputReplySchema).default([]),  // 追加
});
```

### validateGenerationOutput の拡張

シグネチャを拡張し `knownPostRefs` を受け取る。ただし後方互換のために省略可能とする。

```typescript
export const validateGenerationOutput = (
  output: GenerationOutput,
  knownWorkerIds: readonly string[],
  knownPostRefs?: ReadonlySet<string> | readonly string[],
): void => { ... }
```

`knownPostRefs` が渡された場合のみ `targetPostRef` の検証を行う。渡されない場合は従来通りauthor検証のみ。

### buildCommunityPrompt の拡張方針

戻り値を現在の `string` から `{ prompt: string; postRefMap: Map<string, string> }` に変更する。

- `postRefMap`: `参照ID（"ref-1"等）` → `実postId（UUID）` のマッピング
- 参照IDは `"ref-1"`, `"ref-2"`, ... 形式のシンプルな連番とする
- プロンプトに「recentPosts」として参照IDと投稿タイトルを列挙し、「既存PostにReplyを追加してよい」旨を指示

### recentPosts を buildCommunityPrompt に渡す

現在の `recentLog` は `string[]`（フォーマット済みテキスト）で参照IDが含まれていない。そのため、既存Postの参照情報を別途渡す必要がある。

`BuildCommunityPromptParams` に `recentPosts?: readonly { ref: string; id: string; title: string }[]` を追加する。

### runCommunityBatch の拡張

```typescript
// プロンプト構築（recentPostsを渡す）
const { prompt, postRefMap } = buildCommunityPrompt({
  community,
  workers,
  recentLog,
  recentPosts: recentPosts.slice(0, MAX_RECENT_POSTS_FOR_REPLY).map((p, i) => ({
    ref: `ref-${i + 1}`,
    id: p.id,
    title: p.title,
  })),
});

// reply の永続化
for (const reply of output.replies) {
  const postId = postRefMap.get(reply.targetPostRef);
  if (!postId) continue; // 解決できない ref はスキップ（validateで弾かれているはずだが念のため）
  commentInputs.push({
    postId,
    slotKey,
    seq: commentSeq++,
    author: reply.author,
    text: reply.text,
  });
}
```

## 直近Post件数の上限

プロンプトに露出する既存Postの参照数が多すぎると生成品質・コストが下がる懸念がある。定数 `MAX_RECENT_POSTS_FOR_REPLY = 5` とし、最新5件のPostを参照対象にする。

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `common/src/domain/generation/generation.ts` | `GenerationOutputReplySchema` / `GenerationOutputReply` 追加、`GenerationOutputSchema` に `replies` フィールド追加、`validateGenerationOutput` 拡張 |
| `common/src/domain/generation/generation.test.ts` | `replies` 検証テスト追加 |
| `server/src/batch/buildCommunityPrompt.ts` | `BuildCommunityPromptParams` に `recentPosts` 追加、戻り値を `{ prompt, postRefMap }` に変更 |
| `server/src/batch/buildCommunityPrompt.test.ts` | 新テスト追加 |
| `server/src/batch/runCommunityBatch.ts` | `buildCommunityPrompt` 呼び出し変更、reply 永続化ループ追加 |
| `server/src/batch/runCommunityBatch.test.ts` | reply 永続化テスト追加 |
