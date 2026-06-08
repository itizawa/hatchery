# 設計書: feat: ゲストユーザー（未認証）がログインなしでチャンネルを閲覧できるようにする (#255)

## 1. 目的 / 背景

現状、`client/src/router.tsx` の `channelRoute`（`/channels/$channelId`）に `beforeLoad: requireAuth` が設定されており、未ログインユーザーは `/login` にリダイレクトされる。しかし API 側（`GET /api/channels`・`GET /api/channels/:id/messages`）はすでに認証不要で実装済み（#47・#48）。本 Issue ではルーティングガードを外し、ゲストがログインなしでチャンネルを閲覧できるようにする。

## 2. スコープ（やること / やらないこと）

**やること**
- `channelRoute` から `beforeLoad: requireAuth` を削除（受け入れ条件 #1）
- `AppHeader` に未認証ユーザー向けログインリンク/ボタンを追加（受け入れ条件 #6）
- 既存の条件付き UI（MessageInput・EditChannelNameDialog・チャンネル追加ボタン）は変更不要

**やらないこと**
- ホーム画面（`/`）の公開化（#167 LP と合わせて判断）
- SSG・OGP（v2.0.0 #248）
- ゲストセッション管理・`guest` ロール追加

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. 未認証状態で `/channels/$channelId` へアクセスしたとき、`/login` にリダイレクトされず、チャンネル詳細画面のヘッダー見出しが表示される
2. 未認証状態でチャンネル詳細画面を表示したとき、メッセージ一覧が表示される（`GET /api/channels/:id/messages` の結果）
3. 未認証状態でチャンネル詳細画面を表示したとき、メッセージ投稿フォーム（`MessageInput` の送信ボタン）が表示されない
4. 未認証状態でもサイドバーにチャンネル一覧が表示される
5. 未認証ユーザーに対してヘッダーにログインリンクが表示される
6. ログイン済みユーザーにはヘッダーにログインリンクが表示されない
7. `/account`・`/office`・`/admin` は引き続き保護されており、未認証ユーザーは `/login` へリダイレクトされる

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 変更ファイル

| ファイル | 変更内容 |
|---------|----------|
| `client/src/router.tsx` | `channelRoute` から `beforeLoad: requireAuth` を削除。コメントも更新。 |
| `client/src/components/AppHeader.tsx` | `user` が null/undefined のとき、RouterLink の「ログイン」ボタン/リンクを `ml: "auto"` ボックス内に表示する。 |

### 変更不要ファイル（既に対応済み）

- `ChannelScene.tsx`: `{authUser && <MessageInput ...>}` / `{authUser && <EditChannelNameDialog ...>}` でゲスト時非表示
- `SidebarChannelSection.tsx`: `ChannelList`（`useChannels`）は認証不要 API を使用。チャンネル追加ボタンは `{user && ...}` で保護
- `ChannelList.tsx`: `useChannels` は `GET /api/channels`（認証不要）

### `AppHeader.tsx` のログインリンク追加

```tsx
{!user && (
  <Link component={RouterLink} to="/login" ...>
    ログイン
  </Link>
)}
```

`user && (...)` の `else` として `!user && (...)` を追加。実装はシンプル。

## 5. 影響範囲 / 既存への変更

- **client**: `router.tsx`（ルーティングガード削除）、`AppHeader.tsx`（ログインリンク追加）
- **server**: 変更なし
- **common**: 変更なし
- **既存テスト**: `router.test.tsx` の「未ログインでチャンネルを開くと /login へリダイレクト」テストが破綻する → 受け入れ条件に沿って更新する

## 6. テスト計画（TDD で書くテスト一覧）

### `client/src/router.test.tsx`

| テスト | 期待 |
|--------|------|
| 未認証でチャンネルを開くとチャンネル詳細が表示される（リダイレクトなし） | ✅ |
| 未認証でチャンネルを開いたとき MessageInput の送信ボタンが表示されない | ✅ |
| 未認証でもサイドバーにチャンネル一覧が表示される | ✅ |
| 未認証で `/account` を開くと /login へリダイレクト（既存テスト維持） | ✅ |
| 未認証で `/admin` を開くと /login へリダイレクト（既存テスト維持） | ✅ |

### `client/src/components/AppHeader.test.tsx`

| テスト | 期待 |
|--------|------|
| 未認証時にヘッダーにログインリンクが表示される | ✅ |
| ログイン済み時にヘッダーにログインリンクが表示されない | ✅ |

## 7. リスク・未決事項

- **ホーム画面 (`/`)**: 引き続き `requireAuth` を維持。ゲストが `/` にアクセスすると `/login` にリダイレクトされる（スコープ外）。
- **`inviteRoute`** (`/invite/$token`): 既存の公開ルートと同様、変更なし。
