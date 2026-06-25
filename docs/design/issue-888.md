# 設計書: ワーカー作成・編集をモーダルから専用ページに移行し画像アップロードを統合する (#888)

## 1. 目的 / 背景

管理画面でのワーカー作成（`AddWorkerDialog`）と編集（`EditWorkerDialog`）はモーダルダイアログで行っているが、フィールド数増加に伴いスクロール必須な縦長モーダルになっており操作性が悪化している。また画像アップロードは `AdminWorkerTab` に分離されており、「作成直後に画像設定」という自然な操作が 2 画面に分断されている。

## 2. スコープ（やること / やらないこと）

**やること**:
- `/admin/workers/new` — ワーカー作成専用ページ（`AddWorkerScene`）を新設
- `/admin/workers/:workerId/edit` — ワーカー編集専用ページ（`EditWorkerScene`）を新設（`WorkerImageUpload` 統合）
- `AddWorkerDialog` / `EditWorkerDialog` を廃止（ファイル削除）
- `AdminWorkerTable` の「ワーカーを追加」ボタンを `/admin/workers/new` へのナビゲーションに変更
- `WorkerTable` の編集ボタンを `/admin/workers/:workerId/edit` へのナビゲーションに変更
- `requireAdminRoute` ガードで未ログイン・非 admin を `/` へリダイレクト

**やらないこと**:
- `AdminWorkerTab`（アバタータブ）の廃止・統合（別 Issue）
- コミュニティ作成・編集のページ移行（別 Issue #889）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `/admin/workers/new` へアクセスするとワーカー作成フォーム（表示名・役割・参加コミュニティ）が表示される
2. 作成フォーム送信後、作成した Worker の編集ページ（`/admin/workers/:id/edit`）へ自動遷移する
3. `/admin/workers/:workerId/edit` へアクセスするとワーカー編集フォーム（表示名・役割・性格・文章量・参加コミュニティ）と `WorkerImageUpload` が同一ページに表示される
4. 存在しない workerId の場合は「ワーカーが見つかりません」メッセージと `/admin?tab=workers` リンクが表示される
5. `AdminWorkerTable` の「ワーカーを追加」ボタンは `/admin/workers/new` へ遷移する（ダイアログは開かない）
6. `WorkerTable` の編集ボタンは `/admin/workers/:id/edit` へ遷移する（ダイアログは開かない）
7. フォームは `@tanstack/react-form` を使う（`useState` による自前管理禁止）
8. 文字列フィールドは `WORKER_*_MAX_LENGTH` 定数で `.max()` + `maxLength` 二重防御
9. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### ルート追加
`adminWorkerNewRoute` / `adminWorkerEditRoute` を `rootRoute` の直接子として追加（`adminRoute` のネストは不要・独立ページ）。`beforeLoad: requireAdminRoute` で admin ガードを適用。

### AddWorkerScene
- フォーム: 表示名（必須）・役割（任意）・参加コミュニティ（任意）
- 送信: `useCreateAdminWorker` → `useSetWorkerCommunities` → `navigate({ to: "/admin/workers/$workerId/edit", params: { workerId: created.id } })`
- 「戻る」: `/admin?tab=workers` リンク

### EditWorkerScene
- パラメータ: `workerId` を `useParams({ from: "/admin/workers/$workerId/edit" })` で取得
- データ取得: `useWorkerDetail({ workerId })` (suspense) を `QueryBoundary` で包む
- errorFallback で「ワーカーが見つかりません」と `/admin?tab=workers` リンクを表示
- フォーム: `EditWorkerDialog` 相当（表示名・役割・性格・文章量・参加コミュニティ）
- 画像: `WorkerImageUpload` をフォーム上部に統合

### AdminWorkerTable 変更
- `AddWorkerDialog` import と `dialogOpen` state を削除
- 「ワーカーを追加」ボタンを `useNavigate` → `navigate({ to: "/admin/workers/new" })` に変更
  （または `Link to="/admin/workers/new"` を使う）

### WorkerTable 変更
- `EditWorkerDialog` import と `editingWorker` state を削除
- 編集ボタンの `onClick` を `navigate({ to: "/admin/workers/$workerId/edit", params: { workerId: worker.id } })` に変更
- `onEdit` prop は不要になるため削除

## 5. 影響範囲

- **client**: router.tsx / routes/AddWorkerScene.tsx (新規) / routes/EditWorkerScene.tsx (新規) / components/AdminWorkerTable.tsx / components/WorkerTable.tsx
- **削除**: components/AddWorkerDialog.tsx / components/EditWorkerDialog.tsx（+ テストファイル）

## 6. テスト計画

### AddWorkerScene.test.tsx（新規）
- フォームに表示名・役割・参加コミュニティが表示される
- 表示名が空のとき追加ボタンは disabled
- 送信すると createWorker API が呼ばれる

### EditWorkerScene.test.tsx（新規）
- ワーカーデータがフォームに反映される
- WorkerImageUpload が表示される
- ワーカー取得失敗時に「ワーカーが見つかりません」が表示される

### AdminWorkerTable.test.tsx（更新）
- 「ワーカーを追加」ボタンクリックでダイアログが開く → 削除（ダイアログ廃止）

### WorkerTable.test.tsx（更新）
- 編集ボタンクリックで `onEdit` が呼ばれる → 削除（onEdit 廃止）

## 7. リスク・未決事項

- `WorkerTable` の `onEdit` prop を削除すると、既存の `AdminWorkerTable.test.tsx` を更新する必要がある
- `useWorkerDetail` は `useSuspenseQuery` ベースのため 404 エラーは ErrorBoundary で捕捉する必要がある
