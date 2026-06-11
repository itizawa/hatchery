# 設計書: Issue #382 — CharacterSprite・AdminWorkerTable・AdminWorkerTab の RTL テストを追加する

- Issue: #382
- 種別: テスト追加（実装変更なし）
- 関連: `client/src/components/{CharacterSprite,AdminWorkerTable,AdminWorkerTab}.tsx`

## 背景 / 目的

`client/src/components/` 配下で上記 3 コンポーネントだけ RTL テストが無く、表示分岐（行描画・空一覧・ローディング・画像フォールバック）が回帰検証されていない。props / フック駆動の RTL テストを追加してリグレッションを防ぐ。

## 現仕様の確認（テストが表現する仕様）

### CharacterSprite（純 presentational）

- props: `worker: Worker` / `position: {x,y}` / `size: number` / `onClick: (el) => void`
- `role="button"`・`aria-label={worker.displayName}` の要素として描画される。
- クリックで `onClick(currentTarget)` が呼ばれる。Enter / Space キーでも同様（その他のキーでは呼ばれない）。
- `position` が `left/top`、`size` が `width/height` に反映される。
- スプライト本体は装飾 SVG（`aria-hidden="true"`）。**`imageUrl` による画像分岐は現仕様には存在しない**ため、Issue 本文の「実装の props に合わせる」に従い SVG 描画とアクセシビリティを検証する。

### AdminWorkerTable（フック駆動コンテナ）

- `useAdminWorkers()`（`../api/admin.js`）で取得した workers を `WorkerTable` に渡す。
- ヘッダに「社員を追加」ボタンがあり、クリックで `AddWorkerDialog` が開く。
- 空配列ならヘッダ行のみ（データ行 0）。`isLoading=true` ならスケルトン行。

### AdminWorkerTab（フック駆動コンテナ）

- `useBotWorkers()`（`../api/workers.js`）で取得した workers をテーブル表示。
- 列ヘッダ: アバター / 表示名 / 役割。
- 各行: `WorkerImageUpload`（`<displayName> の画像をアップロード` の button、`imageUrl` 有→ img / 無→イニシャル Avatar）+ 表示名 + role（未設定は `—` フォールバック）。
- `isLoading=true` でスケルトン（`admin-worker-avatar-skeleton` 等）。空配列でデータ行 0。

## テスト方針

- presentational（CharacterSprite）は props（fixture）駆動でそのまま描画。
- フック駆動（AdminWorkerTable / AdminWorkerTab）は `vi.mock` で API フックモジュール（`../api/admin.js` / `../api/workers.js`）をモックし、MSW は使わない（HTTP 層は各 API フックのテスト責務）。参照実装 `WorkerTable.test.tsx` と同じく `QueryClientProvider` でラップする。
- `client → common` の一方向 import 境界を守る（テストは `@hatchery/common` の型のみ参照）。

## 受け入れ条件 → テストケース対応

| 受け入れ条件 | テスト |
|---|---|
| CharacterSprite: 表示名が描画される・props に応じた表示 | aria-label / left・top / width・height / SVG aria-hidden |
| CharacterSprite: 操作 | click・Enter・Space で onClick、他キーでは呼ばれない |
| AdminWorkerTable: worker 配列で各行描画 | displayName / role が行に出る |
| AdminWorkerTable: 空配列で 0 行 | ヘッダ行のみ |
| AdminWorkerTable: 主要操作 | 「社員を追加」→ ダイアログが開く / isLoading でスケルトン |
| AdminWorkerTab: 一覧描画 | 列ヘッダ・各行の表示名・role・`—` フォールバック |
| AdminWorkerTab: 画像導線 | 各行に画像アップロードボタン、imageUrl 有無で img / イニシャル |
| AdminWorkerTab: 状態分岐 | isLoading スケルトン / 空配列 0 行 |

## スコープ外

- Storybook stories の追加（別 Issue）。
- コンポーネント実装の変更（テストが現仕様を表現することを確認済み）。
