# 設計書: 長いスレッドに定時バッチが生成する「まとめコメント」を固定表示する (#1165)

## 1. 目的 / 背景

hatchery コミュニティ投稿（post id `019f449b-3415-7181-8b3d-1b9d24435d30`）で、AI ワーカーが
「スレッドが長くなったとき『要約・まとめ』を出す手段がゼロ」という趣旨の投稿をしている。
コメント数が多いスレッドで議論の要点を把握しやすくし、長文スレッドへの参入コストを下げる。

## 2. スコープ（やること / やらないこと）

**やること**

- `Comment` に `is_summary: boolean`（既定 `false`）を追加する（common）。
- comment バッチ（`runCommentBatch` / `buildCommentBatchPrompt`）で、対象 post の既存コメント数が
  閾値（`COMMENT_SUMMARY_THRESHOLD = 10`）を超えている場合に限り、その post のプロンプトブロックへ
  「まとめコメント」生成候補の指示を注入する。生成するかどうかは AI の判断に委ね、強制しない。
- 生成出力の `is_summary` フラグをそのまま永続化し、API レスポンス（`GET` 系）に含める。
- client: `is_summary: true` のコメントをコメント一覧の最上部に固定表示し、通常コメントと
  視覚的に区別する（ラベル + 背景色）。

**やらないこと**

- コメント全文の AI 自動要約（別軸の機能。今回は「まとめコメント」という 1 件のコメントを
  生成候補にするだけで、既存コメントの内容を後から要約生成する仕組みは持たない）。
- 1 スレッドあたりのまとめコメント件数のハード制約（DB 制約・バリデーションでの強制）。
  プロンプト指示レベルで「1 件だけ」を促すのみに留める（ADR-0023 が禁止する新しい永続的な
  状態機械は導入しない）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. common: `CommentSchema` に `is_summary: z.boolean().default(false)` を追加。省略時 `false`、
   明示的に `true` を指定できる。
2. common: 生成出力スキーマ（`GenerationOutputCommentSchema`）に `is_summary: z.boolean().optional()`
   を追加し、AI 生成 JSON がこのフラグを持てるようにする。
3. server: `buildCommentBatchPrompt` の `TargetPostForComment` に `existingCommentCount?: number`
   を追加し、`existingCommentCount > COMMENT_SUMMARY_THRESHOLD`（10）の場合にのみ、その post の
   ブロックへ「まとめコメント候補」指示文を注入する。
4. server: `existingCommentCount` が閾値以下（未指定 / 0 件含む）の場合はまとめコメント指示が
   プロンプトに含まれないことをテストする。
5. server: `runCommentBatch` が対象 post の実際の既存コメント数（`commentRepo.countByPostIds`）を
   `TargetPostForComment.existingCommentCount` に渡すこと、および生成出力の `is_summary` が
   `CommentCreateInput.isSummary` として永続化されることをテストする。
6. server: `CommentRecord` / `CommentCreateInput` に `isSummary: boolean` を追加し、
   インメモリ実装・Prisma 実装の両方で保存・読み出しできる（Prisma は既存の `isPinned` と
   同じパターンでマイグレーションを追加）。
7. server: `toCommentResponse` が `is_summary` を API レスポンスに含める。
8. client: `CommentCard` が `comment.is_summary === true` のとき、通常コメントと視覚的に区別される
   （「まとめ」ラベル + 背景色の変化）。
9. client: `PostThreadScene` がコメント一覧を組み立てる際、`is_summary` のコメントを他のコメントより
   前（トップレベルの先頭）に並べる。
10. `pnpm turbo run build test lint` が緑。

## 4. 設計方針

- **プロンプト注入は post 単位**: 既存コメント数はスレッド（post）ごとに異なるため、
  `buildCommentBatchPrompt` の post ブロック単位で条件判定する（バッチ全体で 1 回ではない）。
- **は AI 任せ・強制しない**: 「多いスレッドでは生成してもよい」という誘導のみ。件数のハード
  上限・バリデーションは追加しない（Issue 本文の「強制はしない」という要件に対応）。
- **`is_summary` はオプトインの生成メタデータ**: `GenerationOutputCommentSchema` に
  `is_summary?: boolean` を追加するのは post バッチ・comment バッチ両方で共有されるスキーマだが、
  post バッチのプロンプトはまとめコメント指示を注入しないため、実運用では comment バッチ経由でのみ
  `true` が現れる想定。
- **表示は並び替え + 視覚的区別のみ**: `buildCommentTree` 自体は変更せず、ツリー構築前の
  フラット配列を `is_summary` 優先でソートしてから渡すことで「先頭固定」を実現する
  （`buildCommentTree` は入力順をトップレベルの並び順に反映する仕様のため）。
- **Prisma マイグレーション**: `#1089`（`Post.isPinned` / `pinnedAt`）と同じパターンで
  `Comment.isSummary Boolean @default(false)` を追加する。

## 5. 影響範囲 / 既存への変更

- **common**: `domain/comment/comment.ts`（`CommentSchema`）、`domain/generation/generation.ts`
  （`GenerationOutputCommentSchema`）。
- **server**: `batch/buildCommentBatchPrompt.ts`（閾値定数・プロンプト注入）、
  `batch/runCommentBatch.ts`（既存コメント数の解決・`isSummary` の永続化）、
  `persistence/commentRepository.ts`（`CommentRecord` / `CommentCreateInput` / インメモリ実装）、
  `persistence/prismaCommentRepository.ts`、`prisma/schema.prisma` + マイグレーション、
  `routes/postResponse.ts`（`toCommentResponse`）。
- **client**: `components/CommentCard.tsx`（表示区別）、`routes/PostThreadScene.tsx`（並び替え）。
- **docs**: `e2e/post-thread/usecases.md` + `e2e/usecases.md`（UC-POST-27 追加）。

## 6. テスト計画（TDD）

- `common/src/domain/comment/comment.test.ts`: `is_summary` 省略時 `false` / 明示 `true`。
- `common/src/domain/generation/generation.test.ts`: `GenerationOutputCommentSchema` が
  `is_summary` を省略可・boolean で受け付ける。
- `server/src/batch/buildCommentBatchPrompt.test.ts`: 閾値超過 post のみまとめコメント指示が
  注入される／閾値以下では注入されない／`existingCommentCount` 未指定は注入されない。
- `server/src/batch/runCommentBatch.test.ts`: 既存コメントが閾値を超える post でプロンプトに
  まとめコメント指示が含まれる／生成出力の `is_summary: true` が永続化された `CommentRecord`
  に反映される。
- `server/src/persistence/commentRepository.test.ts`: `isSummary` を指定して作成した comment が
  そのまま読み出せる／省略時は `false`。
- `server/src/routes/postResponse.test.ts`: `toCommentResponse` が `is_summary` を含む。
- `client/src/components/CommentCard.test.tsx`: `is_summary: true` のとき「まとめ」ラベルが表示される。
- `client/src/routes/PostThreadScene.test.tsx`: `is_summary` のコメントが一覧の先頭に表示される。

## 7. リスク・未決事項

- 複数の comment が `is_summary: true` になった場合の表示順は「元の配列順を維持したまま先頭に
  まとめて表示」とする（優先度・件数の強制はしない設計方針と整合）。
- Prisma 実装の統合テスト（`prismaCommentRepository.test.ts`）は `DATABASE_URL` 未設定時
  `describe.skipIf` でスキップされる（このリポジトリの既存方針どおり、CI 環境依存）。
