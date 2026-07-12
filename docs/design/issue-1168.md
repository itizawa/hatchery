# 設計書: client/src/sw.ts の push/notificationclick 分岐にテストを追加する (#1168)

## 1. 目的 / 背景

`client/src/sw.ts`（Service Worker 本体、#797/#798 で追加）には対応するテストファイル `sw.test.ts` が存在しない。
`push` イベントの JSON パース失敗時のテキストフォールバック分岐、`notificationclick` の既存タブ `focus()` / 新規 `openWindow()` 分岐が未検証で、Web Push 通知の退行を検知できない。

## 2. スコープ（やること / やらないこと）

### やること
- `client/src/sw.test.ts` を新設し、`push` イベントの JSON パース成功/失敗（テキストフォールバック）分岐をテストする
- `notificationclick` イベントの既存タブ発見時 `focus()` / 未発見時 `openWindow()` 分岐をテストする
- `self`（`ServiceWorkerGlobalScope`）と `workbox-precaching` / `workbox-routing` をモックし、`sw.ts` を副作用込みで安全に import できるようにする

### やらないこと
- `sw.ts` 本体の実装変更（既存ロジックは変更しない。テスト追加のみ）
- プレキャッシュ・ナビゲーションフォールバック（`precacheAndRoute` / `NavigationRoute`）自体の検証（workbox 側の責務）
- Service Worker の登録・更新フロー（`main.tsx` 側、スコープ外）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `client/src/sw.test.ts` が存在する。
2. `push` イベントで `event.data.json()` が成功した場合、パースした `title`/`body`/`url` を用いて `self.registration.showNotification` が呼ばれることをテストする。
3. `push` イベントで `event.data.json()` が例外を投げた場合、`event.data.text()` の内容で `body` フォールバックした通知が表示されることをテストする。
4. `notificationclick` イベントで `self.clients.matchAll()` の返り値に遷移先パスと一致し `focus` を持つクライアントが含まれる場合、そのクライアントの `focus()` が呼ばれ `self.clients.openWindow()` が呼ばれないことをテストする。
5. `notificationclick` イベントで一致するクライアントが無い場合、`self.clients.openWindow()` が解決後 URL で呼ばれることをテストする。
6. `pnpm turbo run build|test|lint` が緑であること。

## 4. 設計方針

### テスト対象コードの特性

`sw.ts` はモジュールのトップレベルで `self.skipWaiting()` / `self.addEventListener(...)` / `precacheAndRoute(self.__WB_MANIFEST)` を副作用として実行する。`self` は `ServiceWorkerGlobalScope` 型で、jsdom テスト環境には存在しないため、そのまま `import` すると例外になる。

### 採用するアプローチ: `self` グローバルのモック + モジュール import

1. `vi.mock("workbox-precaching", ...)` / `vi.mock("workbox-routing", ...)` で `precacheAndRoute` 等をノーオペ化し、プレキャッシュ設定によるトップレベル例外を回避する。
2. テスト用の `self` モック（`addEventListener` が呼ばれるたびにイベント種別ごとのハンドラ配列へ登録する簡易 `EventTarget` 相当）を `vi.stubGlobal("self", ...)` で差し込む。
3. `vi.resetModules()` 後に `await import("./sw.js")` で `sw.ts` を評価させ、登録された `push` / `notificationclick` ハンドラを取り出す。
4. 取り出したハンドラに疑似 `PushEvent` / `NotificationEvent`（`waitUntil` を `vi.fn()` にしたもの）を渡して呼び出し、`waitUntil` に渡された Promise を `await` してから `self.registration.showNotification` / `self.clients.focus` / `self.clients.openWindow` へのモック呼び出しを検証する。

この方式は `sw.ts` 本体を変更せず（本 Issue はテスト追加のみがスコープ）、実際に登録されるイベントハンドラをそのまま検証できる。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client）

| 対象 | 変更内容 |
|------|---------|
| `client/src/sw.test.ts` | 新設（`push`/`notificationclick` の分岐テスト） |

`sw.ts` 本体・他ファイルへの変更なし。

## 6. テスト計画（TDD で書くテスト一覧）

`client/src/sw.test.ts`:
1. `push`: JSON パース成功時、パース結果の `title`/`body` で `showNotification` が呼ばれる
2. `push`: JSON パース失敗時、`event.data.text()` の内容で `body` フォールバックされる
3. `notificationclick`: 一致する既存タブがある場合 `focus()` が呼ばれ `openWindow()` は呼ばれない
4. `notificationclick`: 一致する既存タブが無い場合 `openWindow()` が呼ばれる

## 7. リスク・未決事項

- `self` モックの型は `any`/型アサーションに頼らざるを得ない（`ServiceWorkerGlobalScope` は多数のブラウザ API を要求するため、テストに必要な最小限のみ実装しモック外の呼び出しは行われない前提）。
- ユーザー可視の振る舞い変更は無いため `e2e/` の更新は不要（テスト追加のみ）。
