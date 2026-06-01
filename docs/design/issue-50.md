# 設計書: アカウント設定画面を実装してください (#50)

## 1. 目的 / 背景

現在の設定画面（`/settings`）は AI ボット一覧など「管理」的な内容を持つ。#51 でユーザー自身のプロフィール更新機能が必要になり、用途が異なる 2 つの画面を区別するため、設定画面を「管理画面」(`/admin`) へリネームし、ユーザー自身の情報を管理する「アカウント設定画面」(`/account`) を新設する。

## 2. スコープ（やること / やらないこと）

### やること

- `/settings` → `/admin` へのルートリネーム
- SettingsScene のタイトル・ヘッダを「設定」→「管理画面」へ変更
- サイドバーの導線ラベル・リンク先を「管理画面」(`/admin`) へ更新
- `/account` ルートの追加（AccountScene.tsx の空シェル）
- サイドバーに「アカウント設定」導線を追加（ログイン時のみ表示）
- AccountScene の Storybook story を追加
- 既存テストのパス参照を `/admin` に更新

### やらないこと

- AccountScene への具体的な機能実装（プロフィール編集等は #51 のスコープ）
- `/settings` の古い URL からのリダイレクト（要件外）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- [ ] TanStack Router のルートパスが `/settings` → `/admin` に変更されている
- [ ] SettingsScene の見出しが「管理画面」である
- [ ] サイドバーの導線ラベルが「管理画面」で `/admin` へのリンクになっている
- [ ] `/account` ルートが追加されており、AccountScene が描画される
- [ ] サイドバーに「アカウント設定」リンクが表示される（ログイン済み時のみ）
- [ ] AccountScene.stories.tsx が存在し Storybook ビルドが通る
- [ ] 既存テストが全て緑（`/settings` → `/admin` のパス変更を反映）
- [ ] lint が通る

## 4. 設計方針

### ルート構成

```
rootRoute (RootLayout)
  ├── /                 (HomeScene)
  ├── /channels/:channelId (ChannelScene)
  ├── /login            (LoginScene)
  ├── /admin            (SettingsScene) ← リネーム。beforeLoad: requireAuth
  └── /account          (AccountScene) ← 新規追加。beforeLoad: requireAuth
```

### サイドバーの「アカウント設定」表示制御

`useAuth()` フックで取得した `user` が `null` でない場合のみ表示。RootLayout に `useAuth()` を追加して条件分岐する。

### AccountScene の初期実装

空のシェル：タイトル「アカウント設定」のみ表示。#51 で内容を追加する。

## 5. 影響範囲 / 既存への変更

- `client/src/router.tsx`: settingsRoute の path を `/admin` に変更、accountRoute 追加
- `client/src/routes/SettingsScene.tsx`: 見出しを「管理画面」に変更
- `client/src/routes/RootLayout.tsx`: サイドバーリンク更新、`useAuth()` 追加
- `client/src/routes/AccountScene.tsx`: 新規作成（空シェル）
- `client/src/routes/AccountScene.stories.tsx`: 新規作成
- `client/src/routes/SettingsScene.test.tsx`: `/settings` → `/admin` に更新
- `client/src/router.test.tsx`: 必要に応じて `/settings` 参照を修正

## 6. テスト計画（TDD で書くテスト一覧）

1. `/admin` にナビゲートすると「管理画面」見出しが表示される
2. サイドバーの「管理画面」リンクをクリックすると `/admin` へ遷移する
3. `/account` にナビゲートすると「アカウント設定」見出しが表示される
4. 未ログイン時にサイドバーに「アカウント設定」リンクが表示されない
5. ログイン済み時にサイドバーに「アカウント設定」リンクが表示される

## 7. リスク・未決事項

- `SettingsScene.test.tsx` の `renderApp("/settings")` を `/admin` に変更する必要がある。テスト変更は「実装フェーズ中はテストを変更しない」ルールの例外ではなく、パス変更という実装変更に伴うテスト更新として適切。
