# Issue #755 設計書: VoteControl にツールチップを表示する

## 背景・目的

`VoteControl.tsx` の up vote / down vote `IconButton` には `aria-label` が設定されているが、マウスホバー時に視覚的なツールチップが表示されない。ユーザビリティ向上のため、MUI の `Tooltip` コンポーネントでラップしてホバー時に説明文を表示する。

## 受け入れ条件

1. up vote の `IconButton` を `<Tooltip title="高評価">` でラップする
2. down vote の `IconButton` を `<Tooltip title="低評価">` でラップする
3. `Tooltip` は `client/src/components/uiParts` からインポートする
4. 既存の `aria-label="up vote"` / `aria-label="down vote"` は維持する
5. `PostCard`・`CommentCard` の両方でレンダリングされる `VoteControl` でツールチップが表示される（1箇所の変更で両方に反映）
6. 変更は `client/` のみで完結

## 設計方針

### 変更対象

- `client/src/components/VoteControl.tsx` のみ変更（1ファイルのみ）

### 実装方針

- `uiParts` からの `Tooltip` インポートを追加（`@mui/material` の直接インポートは禁止）
- up vote の `IconButton` を `<Tooltip title="高評価">` でラップ
- down vote の `IconButton` を `<Tooltip title="低評価">` でラップ
- `arrow={true}` は `uiParts` の `Tooltip` ラッパーがデフォルトで設定済み（#752 対応済み）のため、明示的な指定は不要

### 変更前後

```tsx
// 変更前
<IconButton aria-label="up vote" ...>
  <ArrowUpward fontSize="small" />
</IconButton>

// 変更後
<Tooltip title="高評価">
  <IconButton aria-label="up vote" ...>
    <ArrowUpward fontSize="small" />
  </IconButton>
</Tooltip>
```

### テスト方針

`VoteControl.test.tsx` に以下を追加:

- up vote ボタンのツールチップタイトルが「高評価」であることを確認
- down vote ボタンのツールチップタイトルが「低評価」であることを確認

MUI の `Tooltip` は `title` prop を `aria-label` としてボタンに付与しないため、`Tooltip` の `title` を確認するには `@testing-library/user-event` でホバーイベントを発火してツールチップ要素を探すか、もしくはコンポーネント構造（`data-mui-internal-clone-element` 属性等）を確認する。
より実用的なアプローチとして、`wrapper` 要素が `title` プロパティを持つかを確認する手法を採用する。

実際には RTL + vitest 環境では `userEvent.hover` を使ってツールチップのテキストが DOM に現れることを確認する方法が最も信頼性が高い。

## 影響範囲

- `PostCard`・`CommentCard` は `VoteControl` をそのまま使用しているため、自動的にツールチップが反映される（変更不要）
- `VoteControl` を使用している他のコンポーネントも同様に自動反映

## e2e ユースケース更新

この変更はマウスホバー時のツールチップ表示という「ユーザー可視の振る舞い」の追加だが、UI の補助情報であり e2e テストの主要なユースケースには影響しない。既存の e2e ユースケースに追記不要と判断する。
