# ADR-0027: Google OAuth 認証の追加（ADR-0010 増補）

- ステータス: Superseded by ADR-0029
- 日付: 2026-06-12
- 関連 Issue: #343

## コンテキスト（背景）

ADR-0010 で ID/パスワード認証（`passport-local`）のみを採用した。当時は「外部 IdP 不要・MVP 過剰」として Google OAuth を却下した。

v1.2.0 では Hatchery が公共コミュニティとして一般ユーザーを広く受け入れるフェーズに入り、パスワード登録なしでオンボーディングできる手段が必要になった。ADR-0010 自身も「将来 OAuth 等に移行する場合は Passport の Strategy を差し替えるだけで対応可能（拡張性あり）」と拡張経路を明示していた。

## 決定

**Google OAuth 2.0（`passport-google-oauth20`）を `passport-local` と共存させて追加する。**

- 既存の ID/パスワード認証は維持する（後方互換）
- `passport-google-oauth20` Strategy を `createPassport` に追加する
- Google 認証を有効にするには `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` の設定が必要。未設定時はエンドポイントを無効化し、起動時エラーにしない
- Google ユーザーは `passwordHash = null`・`googleId = profile.id` で登録される
- `User.passwordHash` を `String?`（nullable）に変更する
- Google ユーザーは `loginId = google_${profile.id}` で自動採番される

## 理由

- **ADR-0010 の拡張経路に沿った実装**: 既存アーキに追加するだけで済み、既存ユーザーへの影響がない
- **passport-google-oauth20 は実績が豊富**: passport-local と同じ passport エコシステムで動作する
- **設定駆動の有効/無効**: 環境変数未設定 → エンドポイント無効化により、認証情報なしのローカル環境・テスト環境に影響しない

## 検討した代替案

- **Auth.js（旧 NextAuth）**: フルスタックフレームワーク前提で、現在の Express 構成には馴染まない。過剰。
- **Auth0 等の外部認証サービス**: 月額コストと外部依存が増える。MVP 規模では不要。
- **passport-google-oidc**: OpenID Connect 準拠だが passport-google-oauth20 との機能差は本プロダクトでは不要。

## 影響（結果）

- `User.passwordHash` が nullable になることで、Local 認証時に `null` チェックが必要（Google ユーザーはパスワード認証不可）
- `UserRepository` に `findByGoogleId` メソッドが追加される
- `User.googleId` フィールドが追加される（既存 User は null）
- Prisma マイグレーションが必要（`passwordHash` の nullable 化 + `googleId` 追加）
- 本番環境で Google OAuth を使うには Google Cloud Console での OAuth 2.0 クライアント設定が必要
