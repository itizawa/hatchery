# 設計書: style: vote 済み時に非選択ボタンを半透明白（灰色）にして選択状態を視覚的に区別する (#891)

## 1. 目的 / 背景

`VoteControl` は vote 済み状態で pill 全体を白色にする実装のため、選択中のボタンも非選択のボタンも同じ白で表示される。どちらが選ばれているか一目で判別できない。

色のみの最小変更で、選択ボタン（白）と非選択ボタン（半透明白＝灰色見え）を区別する。

## 2. スコープ

**やること:**
- `client/src/components/VoteControl.tsx` の各 `IconButton` の `color` sx を方向別に変更
- テスト: `VoteControl.test.tsx` に色状態テストを追加

**やらないこと:**
- アイコン solid/outline 切り替え（#854 で対応済み）
- pill 背景色の変更
- サーバ・OpenAPI スキーマの変更
- props interface の変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. `currentVote="up"` のとき up ボタンの `data-color-state` = `"selected"`、down ボタンの `data-color-state` = `"unselected"`
2. `currentVote="down"` のとき down ボタンの `data-color-state` = `"selected"`、up ボタンの `data-color-state` = `"unselected"`
3. `currentVote=null`（未投票）のとき両ボタンの `data-color-state` = `"unvoted"`
4. `"selected"` 時は `color: "inherit"`（Box の白 `primary.contrastText` を継承）
5. `"unselected"` 時は `color: "rgba(255,255,255,0.4)"`（半透明白）
6. `"unvoted"` 時は `color: "action.active"`（現状どおり）
7. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### 変更箇所

`VoteControl.tsx` の各 `IconButton.sx.color` を方向別に算出する。

```tsx
// Before
color: isVoted ? "inherit" : "action.active"

// After (up button)
color: isVoted ? (currentVote === "up" ? "inherit" : "rgba(255,255,255,0.4)") : "action.active"

// After (down button)
color: isVoted ? (currentVote === "down" ? "inherit" : "rgba(255,255,255,0.4)") : "action.active"
```

Box の `color: isVoted ? "primary.contrastText" : "inherit"` はそのまま維持（Typography スコアテキストを白にする用途）。

各 `IconButton` に `data-color-state` 属性を追加してテスト可能にする:
- `isVoted && currentVote === direction` → `"selected"`
- `isVoted && currentVote !== direction` → `"unselected"`
- `!isVoted` → `"unvoted"`

### テスト戦略

MUI sx の `color` は Emotion CSS クラスに変換されるため `getComputedStyle` での検証が困難。`data-color-state` 属性をデータ端子として利用し、状態をテストする。

## 5. 影響範囲

- `client/src/components/VoteControl.tsx` — sx.color の変更 + data-color-state 属性追加
- `client/src/components/VoteControl.test.tsx` — テスト追加
- `server/` / `common/` / `docs/` — 変更なし

## 6. テスト計画

追加するテストケース（`describe("選択状態の色区別（#891）")`）:

1. `currentVote="up"` → up が `selected`、down が `unselected`
2. `currentVote="down"` → down が `selected`、up が `unselected`
3. `currentVote=null` → 両方 `unvoted`

## 7. リスク・未決事項

- #854（vote 配色・アイコン形状）が同一ファイルを変更済み。本 Issue はその後の develop HEAD から分岐しているので競合は発生しない。
- #912（vote アイコンを MUI アイコンへ切り替え）も同ファイルを触る予定。実装後に本変更と整合させること（#912 側の責任）。
