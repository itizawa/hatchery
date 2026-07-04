# 設計書: 「みんなが言わないこと」コミュニティの投稿タイトルがテンプレ化・重複しており生成会話の質を損なう (#1019)

## 1. 目的 / 背景

本番 API で「みんなが言わないこと」（`unpopular-opinions`）コミュニティの投稿 35 件を取得したところ、
ほぼ全件が「『X』って、Y してない？」という単一の修辞構文に収束しており、かつ全く同一タイトルの
post が複数存在することが確認された（`buildPostPrompt` による post バッチが原因）。

concept.md が「同じような投稿・コメントの繰り返し」「テンプレ感」を明確に劣化として挙げており、
観察エンタメの中核価値を損なうため修正する。

## 2. スコープ（やること / やらないこと）

### やること
- `buildPostPrompt` に `recentTitles?: readonly string[]` パラメータを追加する
- `recentTitles` が非空のとき、既存タイトルの重複を避ける指示をプロンプトに注入する
- `recentTitles` が非空のとき、修辞スタイルの多様化を促す指示をプロンプトに注入する
- `runPostBatch` で `fetchRecentContext` から取得した直近投稿タイトルを `buildPostPrompt` に渡す
- `buildPostPrompt.test.ts` に上記の受け入れ条件テストを追加する

### やらないこと
- 全コミュニティの past データ（既生成の重複タイトル）のバックフィル
- `buildCommunityPrompt`（comment バッチ）への同様の変更（別 Issue）
- 過去タイトルの DB 照合バリデーション（プロンプト指示のみで対応）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `buildPostPrompt` に `recentTitles` を渡すと、タイトル重複回避の指示文言がプロンプトに含まれる
2. `recentTitles` に含まれる各タイトル文字列がプロンプトに明記される
3. `recentTitles` が空配列のとき、タイトル重複回避の指示がプロンプトに含まれない（誤爆防止）
4. `recentTitles` が省略されたとき、タイトル重複回避の指示がプロンプトに含まれない（後方互換）
5. `recentTitles` を渡すと、修辞スタイルの多様化を促す指示がプロンプトに含まれる
6. `pnpm turbo run test|lint` が緑のまま

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### パラメータ追加

```typescript
export interface BuildPostPromptParams {
  community: CommunityRecord;
  workers: readonly WorkerDef[];
  recentLog: readonly string[];
  countHints?: { postCount: number };
  /** 直近の post タイトル一覧（タイトル重複回避・修辞多様化指示に使用）。 */
  recentTitles?: readonly string[];
}
```

### プロンプトへの注入位置

既存 `recentLogSection` の後・JSON 出力指示の前に「既存タイトルとの重複回避」セクションを追加する
（安定 prefix 末尾寄りの可変部に配置し、プロンプトキャッシュ構造を維持）。

### プロンプト文言（案）

```
以下のタイトルは直近の投稿で既に使用されています。同一または酷似したタイトルを使わないでください:
- 「失敗から学べ」って、失敗した人へのバッシングの免罪符になってない？
- ...

また、修辞スタイルが単調にならないよう多様な切り口・文体を選んでください
（例：「〜って、〜してない？」のような同一パターンを繰り返さず、主張・疑問・逆説・観察など
様々な表現形式を混在させてください）。
```

### `runPostBatch.ts` の変更

`fetchRecentContext` の `maxPostsForReply` を `DEFAULT_RECENT_LIMIT` に変更し（DB 追加クエリなし）、
返ってきた `recentPostsForReply` のタイトル一覧を `buildPostPrompt` に渡す。

```typescript
const { recentLog, recentPostsForReply } = await fetchRecentContext({
  ...
  maxPostsForReply: recentLimit,
  ...
});

const { prompt } = buildPostPrompt({
  community,
  workers,
  recentLog,
  countHints: { postCount },
  recentTitles: recentPostsForReply.map((p) => p.title),
});
```

## 5. 影響範囲 / 既存への変更

| 対象ワークスペース | ファイル | 変更内容 |
|---|---|---|
| server | `src/batch/buildPostPrompt.ts` | `recentTitles` パラメータ追加・プロンプト注入ロジック追加 |
| server | `src/batch/buildPostPrompt.test.ts` | 受け入れ条件のテスト追加 |
| server | `src/batch/runPostBatch.ts` | `maxPostsForReply` 変更・`recentTitles` 受け渡し |

## 6. テスト計画（TDD で書くテスト一覧）

1. `recentTitles` あり → タイトル重複回避指示がプロンプトに含まれる
2. `recentTitles` あり → 各タイトル文字列がプロンプトに含まれる
3. `recentTitles` 空配列 → 指示がプロンプトに含まれない
4. `recentTitles` 省略 → 指示がプロンプトに含まれない（後方互換）
5. `recentTitles` あり → 修辞多様化指示がプロンプトに含まれる
6. 既存テスト群が全て緑のまま（リグレッションなし）

## 7. リスク・未決事項

- `recentTitles` 件数が多すぎるとプロンプトが長くなる。現状 `DEFAULT_RECENT_LIMIT=30` を上限にするため
  最悪でも 30 件分のタイトル追加。1 件あたり平均 50 文字として 1500 文字増 ≒ 許容範囲。
- LLM が指示を無視して同一タイトルを生成するリスクは引き続き残る（プロンプト指示のみの制御）。
  バックエンドでの DB 照合チェックは別 Issue で対応可能。
- comment バッチ（`buildCommunityPrompt`）側は今 Issue のスコープ外。
