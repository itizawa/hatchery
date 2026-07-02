# 設計書: PWA インストール導線（スナックバー + ヘッダー常設リンク）を追加する (#799)

## 1. 目的 / 背景

#797 で PWA 対応（Manifest + Service Worker）を実装済み。ブラウザ標準の
インストールバナーは表示タイミングが不安定なため、観察体験を邪魔しない
控えめな 2 経路の導線を追加する。

## 2. スコープ（やること / やらないこと）

### やること
- `beforeinstallprompt` イベントを捕捉して deferred prompt を保持するコンテキスト (`useInstallPrompt`)
- コンテンツを楽しみ始めたタイミングで出る MUI Snackbar（`InstallSnackbar`）
- AppHeader にインストールアイコンボタンを常設
- iOS Safari 向け「共有 → ホーム画面に追加」案内 Dialog
- `e2e/pwa/usecases.md` に UC-PWA-07、UC-PWA-08 を追記

### やらないこと
- インストール率の計測（Cloudflare Analytics への送信）
- A/B テスト・トリガー閾値のチューニング
- Web Push 購読導線（#798 で別途実装済み）
- server への変更

## 3. 受け入れ条件（テストに落とせる粒度）

1. `beforeinstallprompt` を捕捉 → `preventDefault()` → deferred prompt を ref に保持
2. `appinstalled` 検知またはスタンドアロン起動時はスナックバー・常設リンクを非表示
3. ホームフィードで 3 件スクロール → スナックバー表示
4. 初めて up vote → スナックバー表示
5. dismiss 後は localStorage に永続化し再表示しない
6. 「追加する」押下 → deferred prompt 呼び出し（iOS は案内 Dialog を開く）
7. ヘッダーにインストールアイコンボタン（installable かつ未インストール時のみ表示）
8. iOS でも非対応環境でも `isInstallable` が false なら非表示

## 4. 設計方針

### アーキテクチャ

```
InstallPromptProvider (RootLayout 内)
 ├─ AppHeader ── useInstallPrompt() → インストールアイコンボタン表示
 ├─ HomeFeedScene ── useInstallPrompt() → scrolledPast / upvote 通知
 └─ InstallSnackbar ── useInstallPrompt() → shouldShowSnackbar を購読
```

新しいグローバル状態管理ライブラリを導入せず（CLAUDE.md 方針）、
`ExternalLinkProvider` と同パターンの React Context を用いる。

### コンテキスト設計（`useInstallPrompt.ts`）

内部状態:
- `deferredPromptRef: MutableRefObject<BeforeInstallPromptEvent | null>`
- `hasDeferredPrompt: boolean` (state) — `beforeinstallprompt` 受信で true
- `isInstalled: boolean` (state) — standalone 起動 or `appinstalled` で true
- `scrolledPastCount: number` (state) — ホームフィードでスクロール済み件数
- `hasUpvotedOnce: boolean` (state) — 初回 up vote で true、localStorage に永続化
- `isSnackbarDismissed: boolean` (state) — dismiss で true、localStorage に永続化

公開値 (Context):
- `isInstallable = hasDeferredPrompt || isIOS` — スナックバー/常設リンクの表示判定
- `isInstalled` — 非表示判定
- `isIOS` — iOS 固有フロー判定
- `shouldShowSnackbar = isInstallable && !isInstalled && !isSnackbarDismissed && (scrolledPastCount >= 3 || hasUpvotedOnce)`
- `notifyScrolledPast()` — HomeFeedScene がスクロールを通知
- `notifyFirstUpvote()` — HomeFeedScene が up vote 成功を通知
- `dismissSnackbar()` — dismiss 時に呼ぶ
- `promptInstall()` — deferred prompt を呼ぶ

### localStorage キー（衝突を避ける命名）

| キー | 用途 |
|------|------|
| `hatchery:pwa-install-dismissed` | スナックバー dismiss 状態 |
| `hatchery:pwa-install-upvoted` | 初回 up vote 通知済み |

### HomeFeedScene の変更

- 各投稿カードのラッパー `Box` に `data-post-id={post.id}` を追加
- `useEffect` で `IntersectionObserver`（threshold: 0.1）を登録し、
  初めて視野に入った投稿 ID ごとに `notifyScrolledPast()` を呼ぶ（重複排除）
- `onVote` コールバック内で up vote 成功後に `notifyFirstUpvote()` を呼ぶ

### AppHeader の変更

- `useInstallPrompt()` で `isInstallable`・`isInstalled`・`isIOS` を取得
- `showInstallButton = isInstallable && !isInstalled` のとき
  検索アイコンの右に `GetAppRounded` アイコンボタンを常設
- 押下で `promptInstall()`（iOS は `InstallSnackbar` の iOS Dialog を開く代わりに
  `isIOS` 検知で `shouldShowSnackbar` を強制 true にする……は複雑。
  簡素化: AppHeader の押下 → context 経由で `promptInstall()` を呼ぶ。
  iOS では `promptInstall()` が no-op となるため、代わりに iOS Dialog を
  AppHeader 内に直接開く。つまり AppHeader は `isIOS` に応じて Dialog を持つ）

実装メモ: AppHeader は iOS 判定 Dialog を持たせると肥大化する。
別アプローチ: `dismissSnackbar` せず `showInstallButton` 押下で `shouldShowSnackbar` を true に強制する API を追加。
最終決定: AppHeader 内で `promptInstall()` を呼ぶ。iOS の場合は AppHeader 内に直接 iOS install dialog を開く独自ボタンロジックを持つ（`isIOS` を context から取得）。

## 5. 影響範囲

- `client/src/hooks/useInstallPrompt.ts`（新規）
- `client/src/components/InstallSnackbar.tsx`（新規）
- `client/src/routes/RootLayout.tsx`（InstallPromptProvider + InstallSnackbar 追加）
- `client/src/components/AppHeader.tsx`（インストールボタン追加）
- `client/src/routes/HomeFeedScene.tsx`（scroll/upvote 通知）
- `e2e/pwa/usecases.md`（UC-PWA-07, 08 追記）
- `e2e/usecases.md`（PWA 行更新）

server には一切触れない。

## 6. テスト計画（TDD）

### `client/src/hooks/useInstallPrompt.test.ts`
- `beforeinstallprompt` 受信で `isInstallable` が true になる
- `notifyScrolledPast` を 3 回呼ぶと `shouldShowSnackbar` が true になる
- `notifyFirstUpvote` を呼ぶと `shouldShowSnackbar` が true になる
- `dismissSnackbar` を呼ぶと `shouldShowSnackbar` が false になる
- standalone 起動（matchMedia mock）では `shouldShowSnackbar` が false のまま

### `client/src/components/InstallSnackbar.test.tsx`
- `shouldShowSnackbar: false` → スナックバー非表示
- `shouldShowSnackbar: true` → スナックバー表示
- 「追加する」押下 → `promptInstall()` が呼ばれる
- 「×」押下 → `dismissSnackbar()` が呼ばれる
- `isIOS: true` + 「追加する」押下 → iOS Dialog が開く（`promptInstall` は呼ばない）

## 7. リスク・未決事項

- `beforeinstallprompt` は Chrome / Edge / Android ブラウザのみ発火。Safari（非 iOS）は対象外。
- iOS PWA はスタンドアロン起動後も `beforeinstallprompt` は発火しない（`isIOS` で補完）。
- スクロール IntersectionObserver は jsdom 環境でモック必要（Vitest では手動 mock で対応）。
