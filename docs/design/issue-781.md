# Issue #781 設計書: 投稿時刻の表示変更とホバーツールチップ

## 背景・目的

`PostedTime` コンポーネントが表示する時刻フォーマットを改善する。

現状の問題:
1. 24時間以上の「N日前」表示が分かりにくい
2. 相対表示時に正確な時刻が分からない

## 変更概要

### 1. `formatRelativeTime` の閾値変更（`common/src/logic/formatRelativeTime.ts`）

現状:
- 60秒未満: `たった今`
- 60秒〜60分: `N分前`
- 60分〜24時間: `N時間前`
- 24時間〜7日: `N日前` ← 廃止
- 7日以上: `YYYY/M/D`

変更後:
- 60秒未満（または未来）: `たった今`
- 60秒〜60分: `N分前`
- 60分〜24時間: `N時間前`
- **24時間以上: `YYYY/M/D`（絶対時刻）** ← 閾値変更

`WEEK_MS` 定数と `N日前` ブランチを撤去する。

### 2. `formatAbsoluteTime` の新規追加（`common/src/logic/formatAbsoluteTime.ts`）

ツールチップ用に投稿時刻の完全な絶対日時文字列を返す純粋関数。

```ts
export const formatAbsoluteTime = ({ target }: { target: Date }): string
```

フォーマット例: `2026/6/14 12:00:00`（UTC 基準）

`common/src/index.ts` から re-export する。

### 3. `PostedTime.tsx` に Tooltip 追加（`client/src/components/PostedTime.tsx`）

- `uiParts/Tooltip` でラベルをラップ
- `title` に `formatAbsoluteTime` の結果を渡す
- 既存の `<time dateTime={ISO}>` 構造は維持

## 受け入れ条件との対応

| # | 条件 | 対応ファイル |
|---|------|------------|
| 1 | 相対表示は24時間未満のみ | `formatRelativeTime.ts` |
| 2 | 24時間以上は絶対時刻 `YYYY/M/D` | `formatRelativeTime.ts` |
| 3 | 異常系の挙動維持 | `formatRelativeTime.ts` |
| 4 | `formatAbsoluteTime` 新規追加・re-export | `formatAbsoluteTime.ts` / `index.ts` |
| 5 | `formatRelativeTime.test.ts` 更新 | `formatRelativeTime.test.ts` |
| 6 | `formatAbsoluteTime` ユニットテスト | `formatAbsoluteTime.test.ts` |
| 7 | `PostedTime` に `uiParts/Tooltip` 追加 | `PostedTime.tsx` |
| 8 | `<time dateTime>` 構造維持 | `PostedTime.tsx` |
| 9 | `PostedTime.test.tsx` 更新 | `PostedTime.test.tsx` |
| 10 | `common/` と `client/` のみ変更 | — |

## 影響範囲

- `PostedTime` を使う `PostCard` / `CommentCard` / `CommunityBrowseScene` は変更不要
- `server/` / OpenAPI は変更不要
