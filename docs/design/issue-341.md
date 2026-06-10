# 設計書: fix: トップ画面（/）をゲストユーザーが認証なしで閲覧できるようにする (#341)

## 1. 目的 / 背景

`indexRoute`（`/`）に `beforeLoad: requireAuth` が設定されており、未ログインユーザーは `/login` にリダイレクトされていた。
サービスの入口としてトップ画面を公開し、未認証ユーザーもアクセスできるようにする。

## 2. スコープ（やること / やらないこと）

**やること**
- `client/src/router.tsx` の `indexRoute` から `beforeLoad: requireAuth` を削除
- `HomeFeedScene` に `useAuth()` を組み込み、未認証時はゲスト向け誘導 UI を表示（`GET /api/feed` を呼ばない）
- `useHomeFeed` に `enabled` オプションを追加し、未認証時に API コールを抑制できるようにする

**やらないこと**
- ゲスト向け LP・オンボーディング強化（別 Issue）
- `/admin`・`/account` の認証ガード変更（引き続き維持）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `router.tsx` の `indexRoute` に `beforeLoad` が設定されていない
2. 未認証（`authUser == null`）の `HomeFeedScene` はゲスト向け UI（コミュニティを探すボタン）を表示し、`useHomeFeed` を `enabled: false` で呼ぶ
3. 認証済み（`authUser != null`）の `HomeFeedScene` は `useHomeFeed` を `enabled: true` で呼びフィードを表示する
4. `pnpm turbo run build test lint` が緑

## 4. 設計方針

- `useHomeFeed` に `options?: { enabled?: boolean }` を追加し `enabled` を TanStack Query に渡す
- `HomeFeedScene` 内で `useAuth()` を呼び `authUser` が null かどうかでレンダリングを分岐:
  - auth ロード中: スケルトン or ローディング表示
  - 未認証: ゲスト向け誘導 UI（`GET /api/feed` を呼ばない）
  - 認証済み: 従来通りフィード表示

## 5. 影響範囲

- `client/src/router.tsx` — `indexRoute` の `beforeLoad` 削除
- `client/src/api/communities.ts` — `useHomeFeed` に `enabled` オプション追加
- `client/src/routes/HomeFeedScene.tsx` — `useAuth` 組み込み・ゲスト UI 追加

## 6. テスト計画

- `HomeFeedScene.test.tsx` を新規作成:
  - 未認証時にゲスト向け UI が表示される（「ログインしてホームフィードを見る」等）
  - 未認証時に `useHomeFeed` の queryFn が呼ばれない（`enabled: false`）
  - 認証済み時にフィードが表示される

## 7. リスク・未決事項

- `useAuth()` の isLoading 中は `authUser` が undefined → enabled: false のまま。ロード完了後に enabled: true になる（問題なし）
