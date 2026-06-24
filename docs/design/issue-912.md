# 設計書: feat: vote アイコンを自前 SVG（VoteArrow）から以前の MUI アイコン（ArrowUpwardRounded / ArrowDownwardRounded）に戻す (#912)

## 1. 目的 / 背景

`VoteControl` の up/down アイコンは #854 で自前 SVG `VoteArrow`（solid/outline バリアント）に切り替えられた。
ユーザー要望により、アイコンを #854 以前の MUI アイコン（`ArrowUpwardRounded` / `ArrowDownwardRounded`）に戻す。
投票済みの視覚的区別は #813 の pill コンテナ塗りつぶし背景で引き続き担保するため、アイコン solid/outline 出し分けは廃止する。

## 2. スコープ

**やること:**
- `VoteControl.tsx` のアイコンを MUI `ArrowUpwardRounded` / `ArrowDownwardRounded`（`fontSize="small"`）に差し替え
- `VoteArrow` の import と利用を削除
- `client/src/components/icons/VoteArrow.tsx` を削除
- `VoteControl.test.tsx` の solid/outline バリアントテストブロックを MUI アイコン存在確認に置き換え
- JSDoc コメントのアイコン言及を更新
- `docs/design/issue-912.md`（本書）を作成

**やらないこと:**
- 配色・pill 塗りつぶし背景・hover 色の変更（#854/#813 を維持）
- アクセシビリティ・ツールチップ・disabled・score 表示の変更
- server / common / OpenAPI スキーマの変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. up ボタン内に `ArrowUpwardRoundedIcon`（`data-testid`）がレンダリングされる
2. down ボタン内に `ArrowDownwardRoundedIcon`（`data-testid`）がレンダリングされる
3. 未投票・投票済みいずれの状態でも up/down MUI アイコンが同一（solid/outline の切り替えなし）
4. `vote-arrow-*-solid|outline` の `data-testid` が存在しない（VoteArrow 撤去）
5. 既存テスト（score 表示・onVote・aria-pressed・disabled・data-voted・ツールチップ・data-color-state）が緑のまま
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### アイコン差し替え

```tsx
// Before
import { VoteArrow } from "./icons/VoteArrow";
<VoteArrow direction="up" variant={currentVote === "up" ? "solid" : "outline"} />
<VoteArrow direction="down" variant={currentVote === "down" ? "solid" : "outline"} />

// After
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
<ArrowUpwardRounded fontSize="small" />
<ArrowDownwardRounded fontSize="small" />
```

- #808 アイコン規約（Rounded バリアント・個別パス import）遵守
- `fontSize="small"` で既存サイズ感を維持

### テスト戦略

MUI アイコンは jsdom 上で `data-testid="ArrowUpwardRoundedIcon"` 属性を持つ `<svg>` として描画される。
この `data-testid` で存在確認する（`getComputedStyle` 不要）。

`describe("アイコン solid/outline バリアント（#854）")` ブロックを削除し、
`describe("MUI アイコンレンダリング（#912）")` に差し替える。

## 5. 影響範囲

- `client/src/components/VoteControl.tsx` — アイコン差し替え + JSDoc 更新
- `client/src/components/icons/VoteArrow.tsx` — 削除
- `client/src/components/VoteControl.test.tsx` — solid/outline テスト削除 → MUI アイコンテストに差し替え
- `docs/design/issue-912.md` — 本書（新規）
- server / common / e2e — 変更なし（e2e usecases.md は未作成のため更新対象外）

## 6. テスト計画

`describe("MUI アイコンレンダリング（#912）")` に以下を追加:

1. 未投票時に up ボタン内に `ArrowUpwardRoundedIcon` がレンダリングされる
2. 未投票時に down ボタン内に `ArrowDownwardRoundedIcon` がレンダリングされる
3. `currentVote='up'` でも up ボタン内に `ArrowUpwardRoundedIcon` がレンダリングされる（solid 切り替えなし）
4. `currentVote='up'` でも down ボタン内に `ArrowDownwardRoundedIcon` がレンダリングされる
5. 旧 `VoteArrow` の `data-testid`（vote-arrow-up-outline 等）が存在しないこと

## 7. リスク・未決事項

- #891（非選択ボタン半透明化）は既に develop にマージ済み。本 Issue は develop から分岐しており競合なし。
- e2e usecases.md はリポジトリに未作成のため更新不要（PR 本文に明記）。
- `VoteArrow` が他のファイルから利用されていないことは Issue 本文で `grep` 確認済み。
