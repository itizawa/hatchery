# 設計書: e2e admin エリア test.todo 14件を実テストに実装する (#430)

## 1. 目的 / 背景

`e2e/admin/admin.spec.ts` の `test.todo()` 14件（UC-ADMIN-01〜14）がすべてスケルトンのままで、
管理画面（Worker 管理・Community 管理・API トークン設定）のリグレッション検知ができていない。
auth エリア（#426）・home-feed エリア（#427）・community エリア（#428）・post-thread エリア（#429）の
実テスト化に続き、admin エリアのスケルトンを実テストに置き換える。

## 2. スコープ（やること / やらないこと）

### やること
- `e2e/admin/admin.spec.ts` の `test.todo()` 14件を `test()` 実テストに置き換える
- `page.route()` による API モックで、バックエンドなしでブラウザ側の挙動を検証する
- `e2e/admin/usecases.md` の仕様乖離（UC-ADMIN-01 のリダイレクト先・UC-ADMIN-06 の現状）を修正する

### やらないこと
- CI への e2e 組み込み（別 Issue）
- 削除 UI の実装（UC-ADMIN-06 で判明した実装ギャップへの対処は別 Issue）
- その他エリアの e2e テスト

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `e2e/admin/admin.spec.ts` の `test.todo()` 14件すべてが実テスト（`test()`）として実装されていること
2. UC-ADMIN-01・UC-ADMIN-02 で未ログイン/非 admin が管理機能にアクセスできないことを検証する（#136 のロール保護）
3. `e2e/support/test.ts` の `test` を import して使用すること
4. `page.route()` を使った API モックで動作し、実サーバーなしで検証できること
5. `e2e/admin/usecases.md` が実装と整合していること（UC-ADMIN-01 のリダイレクト先 `/login` → `/?login=1`、UC-ADMIN-06 の現状注記）
6. `pnpm turbo run build test lint` が緑であること（e2e 実行は CI 未組み込みのため除く）

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### アプローチ: API モック方式（auth.spec.ts と同じ）

バックエンドなしでブラウザ側の挙動だけを検証する。`page.route()` で必要な API を
インターセプトしてモックレスポンスを返す。

### ヘルパー関数

```typescript
// 認証状態モック
mockUnauthenticated(page)  // GET /api/auth/me → 401
mockAdmin(page)            // GET /api/auth/me → admin ユーザー
mockMember(page)           // GET /api/auth/me → 非 admin ユーザー

// サイドバー用
mockPublicCommunities(page)  // GET /api/communities → []

// 管理画面各タブ用
mockAdminWorkers(page, workers?)     // GET /api/workers → workers
mockAdminCommunities(page, comms?)  // GET /api/admin/communities → comms
mockAdminSettings(page)              // GET /api/admin/settings → []
mockBatchLogs(page)                  // GET /api/admin/batch-logs → []
mockTokenUsage(page)                 // GET /api/admin/token-usage → { logs: [], summary: {...} }
```

### 重要な実装上の注意点

1. **タブ描画ガード**: `SettingsScene.tsx` は `active === t.value && t.content` でタブ内容を条件描画するため、
   URL の `?tab=xxx` に対応したタブの API だけモックすれば十分（他タブの API は呼ばれない）
2. **サイドバーの公開コミュニティ**: `SidebarCommunitySection` が `GET /api/communities`（公開）を呼ぶ。
   各テストで `mockPublicCommunities(page)` が必要
3. **UC-ADMIN-06 のギャップ**: `AdminWorkerTableInner` は `onDelete` を `WorkerTable` に渡していない。
   削除ボタンは現在 UI に存在しない。テストは現状（削除ボタン非表示）を検証し、usecases.md に注記する
4. **EditWorkerDialog の form key**: コミュニティ読み込み完了で Dialog が再マウントされる (`key` 切替)。
   テストでは「保存」ボタンのクリック前にコミュニティ読み込みの完了を待つ

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|----------|
| `e2e/admin/admin.spec.ts` | test.todo() 14件を test() に置き換え |
| `e2e/admin/usecases.md` | UC-ADMIN-01 のリダイレクト先修正・UC-ADMIN-06 に現状注記を追加 |

ユーザー可視の振る舞いは変更しない（テスト追加のみ）。

## 6. テスト計画（TDD で書くテスト一覧）

| UC | テスト観点 | モック |
|----|-----------|--------|
| 01 | 未ログインで /admin → /?login=1 + ログインモーダル | GET /api/auth/me → 401 |
| 02 | 非 admin で /admin → / へリダイレクト | GET /api/auth/me → member |
| 03 | admin で各タブをクリックすると URL が切り替わる | 全タブ API |
| 04 | Worker 一覧テーブルに登録済みワーカーが表示される | GET /api/workers |
| 05 | ワーカー追加ダイアログで作成すると一覧に表示される | POST /api/admin/workers + GET |
| 06 | 削除ボタンが現在 Worker テーブルに表示されていない | GET /api/workers |
| 07 | コミュニティ管理タブで一覧が表示される | GET /api/admin/communities |
| 08 | ワーカー編集ダイアログで参加コミュニティを変更して保存できる | PATCH + PUT |
| 09 | ワーカー新規作成時に参加コミュニティを指定できる | POST + PUT |
| 10 | コミュニティ編集でアイコン画像をアップロードできる | POST image endpoint |
| 11 | データ取得失敗時に「再試行」フォールバックが表示される | GET → 500 |
| 12 | Worker 編集保存失敗でエラー内容がスナックバーに表示される | PATCH → 500 |
| 13 | API トークン保存失敗でエラー内容がスナックバーに表示される | PATCH → 500 |
| 14 | generationInstruction 付きコミュニティを作成できる・公開 API には含まれない | POST + GET /api/communities |

## 7. リスク・未決事項

1. **UC-ADMIN-06 (Worker 削除 UI 未実装)**:
   `AdminWorkerTableInner` が `WorkerTable` の `onDelete` prop を使用しておらず、削除ボタンが表示されない。
   削除 API（`useDeleteWorker`）は存在するが UI に接続されていない。
   → テストは「削除ボタンが表示されない」現状を検証し、usecases.md にギャップを明記する。
   → 削除 UI の実装は別 Issue で対応する。

2. **MUI Select の操作**:
   複数選択 Select の操作は `page.getByRole("option")` で行う。Playwright の MUI 対応は
   Portal 経由でも機能するが、必要に応じてより具体的なセレクタに変更する。
