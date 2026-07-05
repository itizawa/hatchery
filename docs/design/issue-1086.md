# 設計書: 「みんなが言わないこと」の投稿タイトルが同一レトリック構文への収束から解消されていない (#1086)

## 1. 目的 / 背景

Issue #1019 で `unpopular-opinions` コミュニティ向けに「タイトル重複回避・修辞多様化」の指示を
post バッチのプロンプトに注入する対応をしたが、本番データで #1019 クローズ後に生成された投稿を
確認したところ、依然として「『X』って、Yしてない／なってない？」という単一レトリック構文への
収束が続いている。

### 原因調査

- 投稿タイトルを生成する経路は `runPostBatch.ts` → `buildPostPrompt.ts` の 1 本のみ。
  `buildCommunityPrompt.ts`（Issue 本文が言及する処理）は ADR-0034 の post/comment バッチ分離後、
  実装上どこからも呼ばれていないコード（`buildPostPrompt.ts` と `buildCommentBatchPrompt.ts` に
  役割が分割済み）で、comment バッチ（`runCommentBatch.ts`）は既存 post へのコメント生成のみを行い
  新規タイトルは生成しない。よって「反映経路」自体は `buildPostPrompt.ts` の `recentTitlesSection` で
  存在しており、機能していないわけではない。
- 実際に本番の `unpopular-opinions` は 35 件超の投稿履歴を持つため、`recentTitles` は毎回非空で
  プロンプトに注入されている。つまり指示は**確かにプロンプトに届いている**。
- 問題は指示文言が「修辞スタイル・文体・切り口が単調なパターンに収束しないよう、多様な表現形式を
  選んでください」という**抽象的な一般論**にとどまっており、収束している具体的なパターン
  （「〜って、〜してない？」という告発調の否定疑問文）を名指ししていないため、LLM が
  community の `generationInstruction`/`description` が持つ強いレトリック志向を上書きできていない。
- 同種の劣化を別コミュニティ（`trolley-problem`）で解消したとされる #1060 は、AC で
  「問いかけ型以外の文体（断定・体験談・引用・対話形式など）を織り交ぜる」という**具体的な代替
  文体のカタログ**を提示する方式を要求していた。このリポジトリの commit 履歴には #1060 に対応する
  コード変更が見当たらず（15 分で clone なしにクローズされている）、おそらく管理画面から
  community 個別の `generationInstruction`（DB データ）を人手で調整して収束を緩和したと推測される。
  DB データの調整はコミュニティごとに人手が必要で、`unpopular-opinions` には反映されなかった
  （または反映されても効果が薄かった）ため再発した。

### 方針

DB データ（community 個別の `generationInstruction`）に依存せず、**コード側で全コミュニティに
一様に効く構造的な対策**にする。具体的には、直近タイトル群が既知の収束パターンに強く
偏っている場合を**プロンプト構築時に自動検知**し、検知時のみ「そのパターンを名指しした上で、
具体的な代替文体（断定・体験談・引用・対話形式）を今回は使うよう求める」強い指示を追加する。
偏りが弱い場合は #1019 で追加した既存の緩やかな指示のみを維持し、通常時のプロンプト量を
不必要に増やさない。

## 2. スコープ（やること / やらないこと）

### やること

- `buildPostPrompt.ts` に、直近タイトル群の収束パターンを検知する純粋関数
  `detectConvergentTitlePattern` を追加する。
- 検知対象パターンを 2 種類用意する:
  1. 「〜って、〜してない／じゃない？」型の告発調否定疑問文（#1019 / #1086 で実際に観測）
  2. 「体言はYか——副題」型の学術的二項対立タイトル（#1060 で観測）
- `recentTitles` の過半数（閾値 50%・最低サンプル数 4 件）が同一パターンに一致する場合、
  そのパターンを名指しした上で「断定・体験談・引用・対話形式」のいずれか異なる文体を今回は
  使うよう求める強い指示をプロンプトに追加する。
- 収束が検知されない場合は #1019 由来の既存の緩やかな指示のみとする（regression なし）。
- `buildPostPrompt.test.ts` に検知関数単体のテストとプロンプト注入のテストを追加する。

### やらないこと

- production DB の community 設定（`generationInstruction`）の直接編集・バックフィル
  （Dark Factory はコード変更のみを扱う）。
- `buildCommunityPrompt.ts`（未使用コード）の削除・整理（本 Issue のスコープ外・別 Issue で検討）。
- 検知パターンの網羅的な追加（既知の 2 件の実例に基づくもののみ。将来別パターンが観測されたら
  別 Issue で追加する）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `detectConvergentTitlePattern` は、直近タイトルの過半数（4 件以上のサンプルで 50% 以上）が
   「〜って、〜してない／じゃない？」型に一致する場合、そのパターンを表すラベル文字列を返す。
2. `detectConvergentTitlePattern` は、直近タイトルの過半数が「体言はYか——副題」型に一致する場合、
   そのパターンを表すラベル文字列を返す。
3. `detectConvergentTitlePattern` は、タイトル群が多様でどのパターンにも過半数収束していない場合
   `null` を返す。
4. `detectConvergentTitlePattern` は、サンプル数が閾値未満（4 件未満）の場合、全件一致でも
   `null` を返す（少数データでの誤検知防止）。
5. `buildPostPrompt` は、`recentTitles` が収束パターンに該当する場合、検知したパターン名と
   代替文体（断定・体験談・引用・対話形式）を明記した警告指示をプロンプトに含める。
6. `buildPostPrompt` は、`recentTitles` が収束していない場合、上記の強い警告指示を含めない
   （#1019 由来の既存の緩やかな指示のみ）。
7. 既存の #1019 関連テスト（重複回避指示・省略時の後方互換）が引き続き緑であること。
8. `pnpm turbo run build test lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

```typescript
// server/src/batch/buildPostPrompt.ts

interface TitlePattern {
  label: string;
  test: (title: string) => boolean;
}

const MIN_SAMPLE_FOR_PATTERN_DETECTION = 4;
const PATTERN_CONVERGENCE_THRESHOLD = 0.5;

const TITLE_PATTERNS: readonly TitlePattern[] = [
  {
    label: "「〜って、〜してない／じゃない？」型の告発調レトリック疑問文",
    test: (title) => /(してない|じゃない|になってない|てない)[？?]\s*$/.test(title),
  },
  {
    label: "「体言はYか——副題」型の学術的二項対立タイトル",
    test: (title) => /か[—―ー－]{1,2}/.test(title),
  },
];

export function detectConvergentTitlePattern(titles: readonly string[]): string | null {
  if (titles.length < MIN_SAMPLE_FOR_PATTERN_DETECTION) return null;
  for (const pattern of TITLE_PATTERNS) {
    const matchRatio = titles.filter((t) => pattern.test(t)).length / titles.length;
    if (matchRatio >= PATTERN_CONVERGENCE_THRESHOLD) return pattern.label;
  }
  return null;
}
```

`recentTitlesSection` 構築時に `detectConvergentTitlePattern(recentTitles)` を呼び、非 `null` の
場合のみ以下の警告文をタイトル重複回避指示の後段に追記する:

```
⚠️ 直近の投稿タイトルが「<検知したラベル>」に強く収束しています。
今回はこのパターンを使わず、次のいずれか異なる文体でタイトルを作成してください:
断定（言い切り）・体験談（一人称の経験談）・引用（誰かの発言を引用する形）・対話形式（問いと答えのやり取り）。
```

安定 prefix / 可変 suffix 構造（#389 AC4）は変更しない。既存の `recentTitlesSection` は可変部
（直近ログの後）に位置しており、この警告もその内側に留める。

## 5. 影響範囲 / 既存への変更

| 対象ワークスペース | ファイル | 変更内容 |
|---|---|---|
| server | `src/batch/buildPostPrompt.ts` | `detectConvergentTitlePattern` 追加・`recentTitlesSection` に収束時警告を追加 |
| server | `src/batch/buildPostPrompt.test.ts` | 受け入れ条件のテスト追加 |

`buildCommunityPrompt.ts` / `buildCommentBatchPrompt.ts` / `runPostBatch.ts` の呼び出し側インター
フェースは変更しない（`recentTitles` パラメータは既存のまま）。

## 6. テスト計画（TDD で書くテスト一覧）

1. `detectConvergentTitlePattern`: 告発調パターンが過半数 → ラベルを返す
2. `detectConvergentTitlePattern`: 学術二項対立パターンが過半数 → ラベルを返す
3. `detectConvergentTitlePattern`: 多様なタイトル（過半数収束なし）→ `null`
4. `detectConvergentTitlePattern`: サンプル数不足（3件以下）→ 全件一致でも `null`
5. `buildPostPrompt`: 収束時 → 警告指示・代替文体カタログがプロンプトに含まれる
6. `buildPostPrompt`: 非収束時 → 警告指示を含まない
7. 既存 #1019 テスト群のリグレッション確認

## 7. リスク・未決事項

- 閾値（4 件・50%）はヒューリスティックであり、実運用データでの微調整が必要になる可能性がある。
  閾値を超えても LLM が指示を無視するリスクは残る（プロンプト指示のみの制御という限界は #1019
  と同じ）。
- `buildCommunityPrompt.ts` が未使用コードである点は本 Issue の受け入れ条件外だが、今後の
  リファクタ Issue で削除を検討する価値がある（デッドコード）。
- e2e ユースケース: 本変更はバッチ生成プロンプトの内部ロジックのみでユーザー可視の画面・遷移・
  操作結果は変化しないため `e2e/usecases.md` の更新は不要と判断する。
