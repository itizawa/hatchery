# 設計書: vote ウィジェットを Reddit 風配色（up=赤・down=青）にし未投票時は outline アイコンにする (#854)

## 1. 目的 / 背景

`client/src/components/VoteControl.tsx` の up/down vote ウィジェットは現状、配色（up=青・down=赤）とアイコン（常に同一線矢印）が Reddit と逆になっており、見た目の直感性が低い。本 Issue では配色を Reddit 準拠（up=赤・down=青）に揃え、投票状態を solid/outline アイコンの切り替えで視覚的に伝わるようにする。

## 2. スコープ（やること / やらないこと）

### やること
- `SLACK_COLORS` に `voteUp` (`#FF4500`) と `voteDown` (`#7193FF`) を追加
- カスタム SVG アイコンコンポーネント `VoteArrow` を `client/src/components/icons/VoteArrow.tsx` に新設
  - `direction: "up" | "down"` と `variant: "solid" | "outline"` の 2 prop
  - `data-testid="vote-arrow-{direction}-{variant}"` を付与してテスト可能にする
  - `currentColor` で色を引き受けるため親の sx で塗り色を制御できる
- `VoteControl.tsx` を更新: 新 SVG アイコン＋新配色を使う
  - 未投票: 両矢印 outline（中立色 `action.active`）
  - up 投票: pill 背景 `voteUp`、up=solid・down=outline（白系 `primary.contrastText`）
  - down 投票: pill 背景 `voteDown`、down=solid・up=outline（白系 `primary.contrastText`）
- `VoteControl.test.tsx` に TDD テストを追加（solid/outline の `data-testid` 検証）
- `e2e/home-feed/usecases.md` および `e2e/post-thread/usecases.md` の vote 関連 UC を更新

### やらないこと
- common / server / OpenAPI スキーマの変更なし（client のみ）
- vote ロジック（排他・API 呼び出し）・表示数字・aria-pressed・disabled 動作は変更なし
- ADR の更新不要（ADR-0025 の意図に沿う範囲内の変更）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `SLACK_COLORS.voteUp === "#FF4500"` かつ `SLACK_COLORS.voteDown === "#7193FF"`
2. `VoteArrow` コンポーネントが `data-testid="vote-arrow-up-solid"` / `"vote-arrow-up-outline"` / `"vote-arrow-down-solid"` / `"vote-arrow-down-outline"` のいずれかを持つ
3. 未投票（`currentVote=null`）時: `vote-arrow-up-outline` と `vote-arrow-down-outline` が DOM に存在する
4. `currentVote="up"` 時: `vote-arrow-up-solid` と `vote-arrow-down-outline` が DOM に存在する
5. `currentVote="down"` 時: `vote-arrow-down-solid` と `vote-arrow-up-outline` が DOM に存在する
6. 既存テスト（数字表示・onVote 呼び出し・aria-pressed・disabled・data-voted・ツールチップ）がすべて緑のまま
7. `pnpm --filter @hatchery/client test` / `pnpm --filter @hatchery/client lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### カスタム SVG アイコン（`VoteArrow`）

`@mui/icons-material` は線矢印のみで「太い矢印の solid/outline ペア」を作れない（Issue 本文参照）。そのため自前 SVG を MUI の `SvgIcon` でラップする。

**アイコン規約（#808）との関係**: ESLint `no-restricted-imports` は `@mui/icons-material/*` import を対象とする。自前 SVG コンポーネントは `@mui/icons-material` を import しないため制約対象外。

**SVG 形状**:
- `solid`: `polygon` で塗りつぶしの三角形（chevron 型）
  - up: `points="12,5 3,17 21,17"`（頂点上・底辺下・幅広）
  - down: `points="12,19 3,7 21,7"`（頂点下・底辺上）
- `outline`: `polyline` で `fill="none"` + stroke の線（同形状・同幅）
  - up: `points="3,17 12,5 21,17"` + `strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"`
  - down: `points="3,7 12,19 21,7"` + 同 stroke 設定

どちらも `currentColor` で塗られるため、親 Box の `color` sx で白・中立色を切り替えられる。

**`data-testid` 命名**: `vote-arrow-{up|down}-{solid|outline}`

### 色定数

`client/src/theme.ts` の `SLACK_COLORS` に追加:
```ts
voteUp: "#FF4500",   // Reddit オレンジ赤
voteDown: "#7193FF", // Reddit 青
```

### VoteControl の変更

- `ArrowUpwardRounded` / `ArrowDownwardRounded` import を除去
- `VoteArrow` を import
- `bgcolor`: `voteUp` / `voteDown` / `transparent`
- 各ボタン内の icon: `variant` を `currentVote` に応じて切り替え

## 5. 影響範囲 / 既存への変更

| ファイル | 変更種別 |
|---------|----------|
| `client/src/theme.ts` | `SLACK_COLORS` に 2 定数追加 |
| `client/src/components/icons/VoteArrow.tsx` | 新規作成 |
| `client/src/components/VoteControl.tsx` | アイコン・配色変更 |
| `client/src/components/VoteControl.test.tsx` | TDD テスト追加 |
| `e2e/home-feed/usecases.md` | vote UC 更新 |
| `e2e/post-thread/usecases.md` | vote UC 更新 |

利用側（`PostCard` / `CommentCard` / `PostThreadScene`）は `VoteControl` の props インタフェースを変えないため変更不要。

## 6. テスト計画（TDDで書くテスト一覧）

`client/src/components/VoteControl.test.tsx` に以下を追加:

- 未投票時に up アイコンが outline バリアント（`data-testid="vote-arrow-up-outline"`）でレンダリングされる
- 未投票時に down アイコンが outline バリアント（`data-testid="vote-arrow-down-outline"`）でレンダリングされる
- `currentVote="up"` のとき up アイコンが solid バリアント（`data-testid="vote-arrow-up-solid"`）でレンダリングされる
- `currentVote="up"` のとき down アイコンが outline バリアント（`data-testid="vote-arrow-down-outline"`）でレンダリングされる
- `currentVote="down"` のとき down アイコンが solid バリアント（`data-testid="vote-arrow-down-solid"`）でレンダリングされる
- `currentVote="down"` のとき up アイコンが outline バリアント（`data-testid="vote-arrow-up-outline"`）でレンダリングされる

## 7. リスク・未決事項

- SVG の形状（solid 三角 vs 太め chevron）はシンプルな `polygon`/`polyline` で実装し、見た目の調整は実装後に行う。
- Rounded 風の丸み表現は `strokeLinecap/Join="round"` で対応（outline 版）。solid 版は `polygon` のため角張りがあるが許容範囲。
