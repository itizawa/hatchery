# URL 一覧（画面ルーティング表）

> **このドキュメントは、Hatchery クライアント（SPA）の全画面 URL の単一情報源（目次）です。** 画面（ルート）を追加・変更したときは、下のテーブルにここで 1 行を追加・更新してください。各行の「設計書」列から、その画面の詳しい設計書へ辿れます。

- パス表記は **TanStack Router の実体（`$param` 形式）** に統一しています（`:param` / `{param}` は使いません）。
- 正本は実コード `client/src/router.tsx`。本表は同ファイルで定義された全ルートを 1 行ずつ列挙します。
- 本表の対象は **クライアント画面の URL** のみです。サーバ API エンドポイント（`POST /communities` 等）は対象外です。
- 各 URL を洗い出した根拠は、`client/src/router.tsx`（実装）と「設計書」列の各リンク先（per-issue 設計書）で辿れます。

## URL 一覧

| URL / パス | 画面名 | 概要 | 認証 | 設計書 |
|-----------|--------|------|------|--------|
| `/` | ホームフィード（HomeFeedScene） | 購読中コミュニティの新着投稿フィード。未認証時はゲスト向け誘導 UI を表示する | 不要（ゲスト可） | [./issue-341.md](./issue-341.md) / [./issue-307.md](./issue-307.md) |
| `/communities` | コミュニティブラウズ（CommunityBrowseScene） | 公開コミュニティの一覧を閲覧・購読できる公開ページ | 不要 | [./issue-307.md](./issue-307.md) |
| `/communities/$slug` | コミュニティ詳細（CommunityScene） | 特定コミュニティの投稿フィードと購読ボタンを表示する | 不要 | [./issue-307.md](./issue-307.md) / [./issue-257.md](./issue-257.md) |
| `/posts/$postId` | 投稿スレッド（PostThreadScene） | 投稿（post）本文とコメント（comment）一覧を表示する | 不要 | [./issue-307.md](./issue-307.md) |
| `/login` | ログイン（LoginScene） | ID / Password ログイン画面。サイドバーなしの AuthLayout で描画する | 不要 | [./issue-26.md](./issue-26.md) / [./issue-108.md](./issue-108.md) |
| `/admin` | 管理画面（SettingsScene） | 管理者専用の設定画面（ユーザー一覧タブ等）。未ログインは `/login`、非 admin は `/` へリダイレクト | 必須（admin ロール） | [./issue-25.md](./issue-25.md) / [./issue-136.md](./issue-136.md) |
| `/account` | アカウント設定（AccountScene） | 自分自身のアカウント情報を表示・更新する。未ログイン／ネットワークエラー時は `/login` へリダイレクト | 必須 | [./issue-50.md](./issue-50.md) / [./issue-51.md](./issue-51.md) |
| `/invite/$token` | 招待受諾（AcceptInvitationScene） | 招待リンクから新規ユーザー登録を受諾する公開ルート。AuthLayout で描画する | 不要 | [./issue-134.md](./issue-134.md) / [./issue-132.md](./issue-132.md) |

## 補足

- `/login` と `/invite/$token` は、サイドバーを持たない `AuthLayout` で描画されます（その他は `RootLayout`）。詳細は `client/src/router.tsx` の `isAuthLayout` / `AppShell` を参照してください。
- Issue 本文が例示していた旧ルート（`/channels/:channelId`・`/settings` 等）は、Reddit 風 UI への移行（#307・ADR-0018〜0020）でコミュニティ／投稿ベースの URL（`/communities`・`/posts/$postId` 等）へ刷新済みのため、本表では実装済みの実コードを正としています。
