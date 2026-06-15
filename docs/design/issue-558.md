# Issue #558 設計書: vote（人気トピック）を定時バッチの生成プロンプトへ還元する

## 背景

現状 vote（up/down）は、定時バッチの「どのコミュニティを選ぶか」の重み付けにしか使われていない。
選ばれたコミュニティ内の生成プロンプト（`buildCommunityPrompt`）には vote が一切反映されないため、
「どの投稿・論点が支持されたか」が生成に還元されず、人気の話題が続きにくい。

## 目的

選定されたコミュニティ内で「直近で vote を集めた投稿・論点」を生成プロンプトに渡し、
人気トピックの続き・深掘りが起きやすくして、観察体験の連続性を高める。

## 実装方針

### 受け入れ条件 1: post の score 付き取得

既存の `voteRepository` に `topPostsByCommunity` メソッドを追加する方法と、
`postRepository` に score 付き取得を追加する方法がある。

**判断**: `postRepository` の既存 `listByCommunity` には既に `score` フィールドが存在する。
直近 N 日かつスコア >= threshold でフィルタリングする `listTopByCommunity` を追加する。

- `postRepository.listTopByCommunity(communityId: string, params: { since: Date; minScore: number; limit: number }): Promise<PostRecord[]>`
- score >= minScore かつ createdAt >= since の post を score 降順で最大 limit 件返す。

### 受け入れ条件 2: buildCommunityPrompt に人気トピックセクションを追加

- `BuildCommunityPromptParams` に `popularPosts?: readonly PopularPostEntry[]` を追加（省略可）
- 人気 post がある場合は「特に反応が良かった投稿/論点」セクションを安定 prefix 側（ワーカー一覧の直後）に追加
- 人気 post がない場合はセクションを省略（出力が空でもプロンプトが壊れない）

### 受け入れ条件 3: 閾値・件数・対象期間の名前付き定数

`runCommunityBatch.ts` に以下の名前付き定数を定義する:
- `POPULAR_POSTS_WINDOW_DAYS = 7` — 集計対象期間（日数）
- `POPULAR_POSTS_MIN_SCORE = 1` — 最小スコア閾値（0 以下は除外）
- `POPULAR_POSTS_LIMIT = 3` — プロンプトに載せる件数上限

### 受け入れ条件 4: 既存フローを壊さない

- `buildCommunityPrompt` の既存シグネチャは後方互換を保つ（`popularPosts` は省略可）
- `GenerationOutputSchema` / `validateGenerationOutput` / `slot_key` 永続化は変更しない
- `runCommunityBatch` はプロンプト構築前に `postRepo.listTopByCommunity` を呼び、結果を `buildCommunityPrompt` に渡す

### 受け入れ条件 5: スコープ

- client は変更しない
- import 境界（server → common の一方向）を守る
- 純粋な集計ロジックを common に移すには理由が薄いため、`listTopByCommunity` は server の postRepository 内に留める

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `server/src/persistence/postRepository.ts` | `listTopByCommunity` を `PostRepository` インターフェースと in-memory 実装に追加 |
| `server/src/persistence/prismaPostRepository.ts` | `listTopByCommunity` の Prisma 実装を追加 |
| `server/src/batch/buildCommunityPrompt.ts` | `PopularPostEntry` 型・`popularPosts` パラメータを追加。人気トピックセクションを安定 prefix に追加 |
| `server/src/batch/runCommunityBatch.ts` | 名前付き定数追加・`buildCommunityPrompt` 呼び出し前に `listTopByCommunity` 呼び出しを追加 |

## テスト方針

1. `postRepository.test.ts`: `listTopByCommunity` のユニットテスト（since 以降 / minScore 以上 / limit / 空結果 / score 降順）
2. `buildCommunityPrompt.test.ts`: `popularPosts` あり/なしのプロンプト内容テスト（セクション有無・順序）
3. `runCommunityBatch.test.ts`: `listTopByCommunity` が呼ばれることの spy テスト + 結果が `buildCommunityPrompt` に渡ることの確認

## プロンプトセクション案

```
特に反応が良かった投稿（直近 7 日間）:
- 「<title>」（by <author>, score: <score>）
- 「<title>」（by <author>, score: <score>）
（この話題の続きや関連を歓迎します。）
```

## 考慮事項

- **セクション位置**: 安定 prefix 側（ワーカー一覧の直後・直近ログの前）に置く。
  これにより将来キャッシュを有効化する際は直近ログとセットで可変 suffix に移動できるが、
  今は人気トピックは更新頻度が低いため安定 prefix 扱いで問題ない。
- **スコープ外**: ワーカーの成長メカニクス・関係値（ADR-0023 禁止）は一切導入しない。
