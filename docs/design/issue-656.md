# Issue #656 設計書: client の PostedTime コンポーネントのユニットテストを追加する

## 背景・目的

`client/src/components/PostedTime.tsx` は投稿時刻を相対時間で表示するコンポーネントだが、テストが存在しない。
`formatRelativeTime` の単体テストは common に整備済みだが、コンポーネントのレンダリング（`<time dateTime>` の正確な出力・null 返却ケース・不正日付の安全処理）は未テスト。

本 Issue はコンポーネントレベルのレンダリングテストを追加することで、表示崩れや例外を早期検出する安全網を整える。

## 設計判断

### テスト対象の整理

`PostedTime` コンポーネントは以下の3つの分岐を持つ：

1. `createdAt` が falsy（null / undefined / 空文字）→ `null` を返す（何も描画しない）
2. `createdAt` が不正な日付文字列 → `Number.isNaN(target.getTime())` で弾き `null` を返す
3. 有効な ISO 文字列 → `<time dateTime={...}>` 要素を描画する

### テストケース設計

受け入れ条件に基づき以下をテストする：

1. **正常系（有効 ISO 文字列）**
   - `<time>` 要素が描画される
   - `dateTime` 属性に ISO 形式文字列が設定される
   - ラベルテキスト（相対時間）が表示される

2. **null ケース** - `createdAt={null}` のとき `<time>` 要素が描画されない

3. **undefined ケース** - `createdAt` prop を渡さないとき `<time>` 要素が描画されない

4. **不正日付ケース** - `createdAt="not-a-date"` のとき `<time>` 要素が描画されない（例外なし）

### 時刻固定の方針

`formatRelativeTime` が `new Date()` を参照するため、`vi.useFakeTimers()` + `vi.setSystemTime()` で現在時刻を固定する。
テスト用の `createdAt` は `"2026-06-01T09:00:00Z"` とし、現在時刻を `"2026-06-01T12:00:00Z"` に固定（3時間前）。

### 参照実装

- `client/src/components/PostCard.test.tsx` — RTL テストの基本パターン
- `common/src/logic/formatRelativeTime.test.ts` — テストケースの参考

## スコープ

- **対象**: `client/src/components/PostedTime.test.tsx`（新規作成）
- **対象外**: `formatRelativeTime` ロジック自体（common に既存）
- **変更ファイル**: `client/src/components/PostedTime.test.tsx` のみ
