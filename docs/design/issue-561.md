# 設計書: フィードにコンパクト表示モードを追加する (#561)

## 1. 目的 / 背景

現在の `PostCard` はカード形式のみで、タイトル・本文・投票ボタンを縦に並べる。
投稿数が多いほど縦スクロール量が増える課題があり、コンパクト表示モードを追加して密なフィードを実現する。

## 2. スコープ（やること / やらないこと）

**やること**:
- `useViewMode` hook（localStorage 永続化）を新規作成
- `PostCard` に `compact` prop を追加（パディング縮小・本文非表示）
- `HomeFeedScene` にカード/コンパクト切り替えトグルボタンを追加
- `CommunityScene` にも同じトグルを追加
- `PostCard` と `useViewMode` のテストを追加

**やらないこと**:
- サーバーサイドでのユーザー設定保存（今回は localStorage のみ）
- コンパクトモードでのサムネイル表示
- `PostThreadScene` への適用
- `client/` 以外のワークスペースへの変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `useViewMode()` の初期値は `'card'`（localStorage に値がない場合）
2. `toggleViewMode()` 呼び出しで `'card'` → `'compact'` → `'card'` と交互に切り替わる
3. `localStorage.getItem('feedViewMode')` でモードが取得できる（永続化）
4. `localStorage` に既存値がある場合、初期値としてその値を使う
5. `PostCard` に `compact=true` を渡すと本文テキストが `display: none` になる
6. `PostCard` に `compact=true` を渡してもタイトルは表示される
7. `HomeFeedScene` にトグルボタンが表示される（ViewStream/ViewHeadline アイコン）
8. `CommunityScene` にトグルボタンが表示される

## 4. 設計方針

### useViewMode hook

```ts
type ViewMode = 'card' | 'compact';

interface UseViewModeReturn {
  viewMode: ViewMode;
  toggleViewMode: () => void;
}
```

- `useState` + `localStorage` で単純に実装（サーバー同期不要）
- `useGuestVoteGuard.ts` の hook 構造を参照

### PostCard の compact prop

```ts
interface PostCardProps {
  // ... 既存 ...
  compact?: boolean;
}
```

- `compact=true` のとき:
  - `p: 2 → p: 1`（Box の padding）
  - `mb: 1 → mb: 0.5`（Box の margin bottom）
  - 本文テキストのラッパーに `display: 'none'` を適用
  - タイトルの `mb: 0.5 → mb: 0`

### トグルボタン

MUI の `IconButton` + `Tooltip` を使用。
- カードモード: `ViewStreamIcon`（ViewStream = 広いカード表示）
- コンパクトモード: `ViewHeadlineIcon`（ViewHeadline = 密な一覧）
- `HomeFeedScene` の `Typography variant="h5"` 右側に `Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}` でラップして配置

## 5. 影響範囲 / 既存への変更

| 対象 | 変更 |
|------|------|
| `client/src/hooks/useViewMode.ts` | 新規作成 |
| `client/src/hooks/useViewMode.test.ts` | 新規作成 |
| `client/src/components/PostCard.tsx` | `compact` prop 追加 |
| `client/src/components/PostCard.test.tsx` | compact テスト追加 |
| `client/src/routes/HomeFeedScene.tsx` | トグルボタン追加・PostCard に `compact` 渡す |
| `client/src/routes/CommunityScene.tsx` | トグルボタン追加・PostCard に `compact` 渡す |

## 6. テスト計画（TDDで書くテスト一覧）

### useViewMode.test.ts

1. 初期値が `'card'` であること（localStorage なし）
2. `toggleViewMode()` で `'card'` → `'compact'` に切り替わること
3. `'compact'` から `toggleViewMode()` で `'card'` に戻ること
4. `localStorage` の `feedViewMode` に値が保存されること
5. `localStorage` に既存値がある場合、その値で初期化されること

### PostCard.test.tsx への追加

6. `compact=true` のとき本文テキストが `display: none` になること
7. `compact=true` でもタイトルは表示されること

## 7. リスク・未決事項

- MUI アイコンは `@mui/icons-material` パッケージ（既存依存か確認要）
- `ViewStreamIcon` / `ViewHeadlineIcon` が最適なアイコン選択か（他の候補: `DensityLarge` / `DensitySmall`）
