# ADR-0029: 認証を Google ログインのみに統一し ID/パスワード・招待制を廃止する

- ステータス: Accepted
- 日付: 2026-06-13
- 関連 Issue: #455
- 上書き: ADR-0010（ID/パスワード認証）、ADR-0027（Google OAuth 追加）

## コンテキスト（背景）

ADR-0027 で Google OAuth を ID/パスワード認証と共存させた。しかし Hatchery は「放置して眺める観察エンタメ」であり、ユーザーの関与は up vote とコミュニティ購読のみ（ADR-0023）。登録フローの複雑さを最小にするため、Google ログインへの一本化が求められる。

- **ID/パスワード認証**は Google OAuth と重複する認証経路となった。ユーザー体験の分岐・`passwordHash` カラムの管理コストを払い続ける理由がない。
- **招待制**（`InvitationLink` テーブル・`/invite/:token` フロー）は公共コミュニティへの移行（ADR-0018）と矛盾する。公共コミュニティは招待不要で誰でも閲覧できる。
- **`loginId`** は Google 認証後に `google_${profile.id}` で自動採番されていたが、ユーザーには不要な内部識別子。`email` + `googleId` で十分に一意性を保証できる。

## 決定

**認証を Google OAuth 2.0 のみとし、ID/パスワード認証・招待制を完全廃止する。**

### DB 変更（Prisma）

- `User` モデルから `loginId String @unique` と `passwordHash String?` を削除。
- `User` モデルに `email String @unique` を追加（必須）。
- `User.googleId` を `String @unique`（NOT NULL）に変更。
- `InvitationLink` テーブルを廃止・削除。

### サーバー変更

- `passport-local` Strategy を完全削除。
- `POST /api/auth/login` エンドポイントを廃止（404 を返す）。
- 招待関連ルート（`/api/invitations/*`）を廃止。
- `UserRepository` インターフェースから `findByLoginId`・`LoginIdAlreadyExistsError` を削除し、`findByGoogleId` に一本化。
- 開発環境専用バイパス `POST /api/auth/dev-login` を追加（`NODE_ENV !== "production"` のみ有効）。テストでサーバーサイドをログイン済み状態にするための非本番専用エンドポイント。

### クライアント変更

- ログイン画面（`LoginScene.tsx`）の ID/パスワードフォームを削除し、Google でログインボタンのみ表示。
- 招待関連コンポーネント・API クライアント・ルート（`/invite/:token`）を削除。
- 管理画面の「招待」タブを削除。

## 理由

- **認証経路の一本化**: Google ログインのみにすることで、認証フローのコードパスが半分以下になる。
- **データモデルの簡素化**: `loginId`・`passwordHash` の廃止により、User エンティティが `id / email / googleId / displayName / role / avatarUrl` のみの明確な構造になる。
- **招待制の廃止**: ADR-0018（公共コミュニティ移行）の決定と整合する。
- **開発環境バイパス**: `dev-login` エンドポイントにより、Google OAuth コールバックを必要としないテストが可能。

## 検討した代替案

- **ID/パスワード認証を残す**: Google ログインの代替として維持することも検討したが、2 つの認証経路の維持コストとユーザー体験の分岐を考えると廃止が合理的。
- **招待制を維持しつつ Google 認証のみ**: 招待制はコミュニティの性質上（公共・観察エンタメ）不要。廃止が適切。

## 影響（結果）

- 既存の ID/パスワードユーザーは Google 再認証が必要（データマイグレーションは手動対応）。
- `UserRepository` インターフェースが `findByGoogleId` に一本化されテストが簡素化される（`createTestDeps()` が同期関数になる）。
- Prisma マイグレーション（`20260613000000_google_only_auth`）で `email` カラム追加・`loginId`/`passwordHash` カラム削除・`InvitationLink` テーブル削除を行う。
- 本番環境で `dev-login` エンドポイントは `NODE_ENV=production` により無効化される。
