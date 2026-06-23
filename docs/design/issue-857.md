# 設計書: fix: ポスト詳細のローディング Skeleton をコメント実 UI と一致させ崩れ（潰れ）を解消する (#857)

## 1. 目的 / 背景

`PostThreadScene` のローディング表示で使われる `PostThreadSkeleton.tsx` のコメント部分が、実 UI（`CommentCard`）の骨格と一致しておらず、ローディング中に潰れて見える。#807 の follow-up として `CommentCard` に `loading` prop を追加し、`PostThreadSkeleton` を置き換える。

## 2. スコープ（やること / やらないこと）

**やること**
- `CommentCard` に `loading?: boolean` を discriminated union で追加（loading 時にデータ系 prop 不要）
- `loading={true}` のとき、実 UI と同一骨格の Skeleton を描画（左アバター列 24px + 右列に著者名・本文・アクションバー相当の Skeleton）
- `PostThreadSkeleton` の手書き `CommentCardSkeleton` を `<CommentCard loading />` に置き換え
- テスト追加: loading 時に Skeleton が描画されデータ由来テキストが出ないこと / 非 loading 時に従来表示

**やらないこと**
- 深さ（インデント）やコネクター線の Skeleton 再現（最小実装として不要）
- 他画面への loading Shell 化の横展開
- `PostThreadScene.test.tsx` / `PostThreadSkeleton.test.tsx` の既存テストの変更（緑のまま維持）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `<CommentCard loading />` をレンダーすると `Skeleton` 要素が描画される（MUI `.MuiSkeleton-root`）
2. `<CommentCard loading />` をレンダーするとデータ由来のテキスト（author 名・本文・score 等）が DOM に存在しない
3. `<CommentCard comment={...} onVote={...} />` は従来通り動作する（既存テストが緑）
4. `PostThreadSkeleton` に手書き `CommentCardSkeleton` が存在しない（`CommentCard loading` の合成に置き換え済み）
5. `data-testid="post-thread-skeleton"` が維持されている
6. `pnpm turbo run test --filter=@hatchery/client` が全緑

## 4. 設計方針

### discriminated union パターン（PostCard と同形）

```ts
type CommentCardProps =
  | { loading: true }
  | {
      loading?: false;
      comment: Comment;
      onVote: (direction: VoteDirection) => void;
      currentVote?: VoteDirection | null;
      voteDisabled?: boolean;
      depth?: number;
      children?: ReactElement | null;
      hasChildren?: boolean;
      postId?: string;
    };
```

### loading 時の描画骨格

実 UI の `pl: 16px` 外枠 → `display: flex, py: 0.75` 内枠 → 左列 `width: 24` + 右列 `flex: 1` を踏襲し、Skeleton を配置する:

- 左列: `Skeleton variant="circular" width={24} height={24}`
- 右列:
  - 著者名+時刻相当: `Skeleton variant="text" width="40%"`
  - 本文 1 行目: `Skeleton variant="text" width="90%"`
  - 本文 2 行目: `Skeleton variant="text" width="70%"`
  - アクションバー相当: `Skeleton variant="text" width="30%"`

コネクター線・インデントは Skeleton に再現しない（最小実装で骨格一致は十分達成できる）。

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|----------|
| `client/src/components/CommentCard.tsx` | 型を discriminated union に変更、loading 分岐の描画追加 |
| `client/src/components/PostThreadSkeleton.tsx` | `CommentCardSkeleton` 廃止 → `<CommentCard loading />` に置き換え |
| `client/src/components/CommentCard.test.tsx` | loading レンダリングテストを追加 |

## 6. テスト計画（TDD で書くテスト一覧）

1. `loading={true}` のとき Skeleton が描画される
2. `loading={true}` のときデータ由来テキストが存在しない
3. `loading={false}`（通常）のとき従来表示になる（既存テスト維持）

## 7. リスク・未決事項

- `CommentCard` の discriminated union 化で既存呼び出し箇所の型エラーが出ないか確認が必要（loading は optional=false がデフォルトなので後方互換）
- `e2e/` 更新: 本件はローディング表示の構造修正であり、ユーザー観察可能な期待動作は変わらない。e2e/usecases.md の更新は不要。
