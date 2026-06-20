# 設計書: PostCard のアクションバーを MUI Clickable Chip スタイルに変更する (#747)

## 1. 目的 / 背景

PostCard のアクションバー（vote・コメント数・共有）が現在 `IconButton` + `Typography` + `IconButton` の個別要素で構成されており、ユーザーから「Reddit のように pill 型ボタンにしてほしい」という要望がある。MUI `Chip`（`clickable`）ベースの pill 型ボタンに統一し、視覚的まとまりを持たせる。

## 2. スコープ（やること / やらないこと）

**やること:**
- `VoteControl.tsx`: up/down ボタンを `IconButton` → `Chip`（`clickable`）に変更
- `ShareButton.tsx`: 共有ボタンを `IconButton` → `Chip`（`clickable`）に変更
- `PostCard.tsx`: コメント数表示を `Typography` → `Chip`（非 clickable、`variant="outlined"`）に変更

**やらないこと:**
- コメント一覧への遷移動作の変更
- PostCard 以外（CommunitySidebarCard 等）への Chip 適用
- 新しいプロップの追加・APIの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. VoteControl の up/down ボタンが `Chip`（`clickable`）で表示される（`aria-label="up vote"` / `"down vote"` を維持）
2. Chip は `aria-pressed={currentVote === "up"/"down"}` を持ち、pressed 状態を正しく表す
3. `disabled=true` のとき両 Chip が無効化状態になる（`aria-disabled="true"` または `disabled` 属性）
4. コメント数が `Chip` で表示される（`aria-label={コメント N 件}` を維持、`variant="outlined"` 等）
5. 共有ボタンが `Chip`（`clickable`）でレンダリングされる（`aria-label="共有"` を維持）
6. 既存の全テスト（VoteControl/ShareButton/PostCard）が通過する
7. `pnpm turbo run build test lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### VoteControl の Chip 構成（3 要素構成を採用）

up Chip・score Typography・down Chip の 3 要素構成（「up/down を 1 つの Chip にまとめる構成」ではなく）を採用する。理由:
- スコアは up/down の集計値であり、どちらか一方の Chip に含めるのは意味的に不自然
- クリックターゲットを up と down で明確に分離できる
- 既存テストの `getByText(score)` が素直に通る

```tsx
<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
  <Chip clickable icon={<ArrowUpwardIcon />} label="" aria-label="up vote" aria-pressed={...} />
  <Typography variant="body2">{score}</Typography>
  <Chip clickable icon={<ArrowDownwardIcon />} label="" aria-label="down vote" aria-pressed={...} />
</Box>
```

### ShareButton の Chip 構成

```tsx
<Chip clickable icon={<ShareIcon />} label="共有" aria-label="共有" onClick={handleOpen} size="small" />
```

Tooltip は不要（Chip 自体に label="共有" が表示されるため視覚的に自明）。

### PostCard コメント数 Chip

```tsx
<Chip
  icon={<ChatBubbleOutlineIcon />}
  label={commentCount}
  variant="outlined"
  size="small"
  aria-label={`コメント ${commentCount} 件`}
/>
```

### スタイル方針

- `size="small"` を標準とし、コンパクト表示と調和する
- `bgcolor: "background.paper"` / `borderColor: "divider"` はテーマから自動適用される `variant="outlined"` と `sx` で調整
- up vote 選択時: primary.main 色、down vote 選択時: error.main 色（既存の色設計を踏襲）

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- **client**: `VoteControl.tsx`、`ShareButton.tsx`、`PostCard.tsx`のみ
- **server / common / docs**: 変更なし
- ユーザー可視の振る舞い（クリック動作・アクセシビリティ）は維持、視覚的スタイルのみ変化

## 6. テスト計画（TDD で書くテスト一覧）

既存テストがアクセシビリティ属性・クリック動作・スコア表示を網羅している。新規に Chip レンダリング固有の検証テストを追加する:

- `VoteControl.test.tsx`: "up/down ボタンは div 要素（MUI Chip）として表示される"（IconButton は button 要素のため区別可能）
- `ShareButton.test.tsx`: "共有ボタンは div 要素（MUI Chip）として表示される"
- `PostCard.test.tsx`: "コメント数は Chip としてレンダリングされる"（Chip が持つ `MuiChip-root` クラスで判定）

## 7. リスク・未決事項

- MUI Chip の `disabled` 状態: `clickable` + `disabled` のとき `aria-disabled="true"` が付与されることを実装時に確認する（`toBeDisabled()` マッチのため）
- `label=""` の空文字を持つ Chip の視覚的な表示（icon のみ表示）が意図通りかビルドで確認
