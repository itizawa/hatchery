# ADR-0010: 認証方式: ID/Password（passport-local + express-session）

- ステータス: Accepted
- 日付: 2026-05-30
- 関連 Issue: #26

## コンテキスト（背景）

Hatchery はログイン機能がなく、誰でも全画面にアクセスできる状態にある。
観察者がログインできる最小の認証基盤を設け、設定画面等の保護ルートを未ログインユーザーから隔離する必要がある。

MVP フェーズの制約:
- ユーザー数は少なく、スケール要件はない
- 外部 IdP との連携は不要（内部ツール的な性質）
- 最短で実装できる認証が必要

## 決定

**ID/Password 認証（`passport-local`）+ セッション cookie（`express-session`）を採用する。**

- 認証ライブラリ: `passport` + `passport-local`
- セッション管理: `express-session`（cookie ベース、`httpOnly: true` / `sameSite: 'lax'`、本番 `secure: true`）
- パスワード保存: `bcrypt` によるハッシュ化（平文保存・照合は禁止）
- User モデルを Prisma に追加（id / displayName / passwordHash）
- 開発環境専用のシードユーザーを `prisma/seed.ts` で用意（本番では作成しない）

## 理由

- **実装コストが最小**: passport-local は Express との統合実績が豊富で設定が少ない
- **依存の透明性**: JWT ライブラリなし、外部サービスなしで自己完結する
- **既存アーキとの整合**: ADR-0004（Express + Prisma）の延長で自然に実装できる
- **MVP スコープに合致**: ログイン済みか否かの単純ガードのみで十分な現フェーズに適合する

## 検討した代替案

- **JWT（JSON Web Token）**: ステートレスでスケールしやすいが、トークン失効の仕組みが必要になり MVP には過剰。実装コストも高い
- **OAuth 2.0 / Google SSO**: 外部 IdP が不要なため採用しない。追加の設定・コールバック URL 管理・シークレット管理が必要で複雑度が上がる
- **magic link（メール認証）**: メール送信インフラが必要で MVP に過剰

## 影響（結果）

- `User` テーブルが DB に追加される（Prisma マイグレーション必要）
- `SESSION_SECRET` 環境変数の管理が必要（`.env.example` に記載）
- セッションストアはデフォルトのメモリストア（本番用途には Redis 等が必要。スケール対応は別 Issue）
- 本番デプロイ時は `SESSION_SECRET` を強いランダム値に変えること
- 将来 OAuth 等に移行する場合は Passport の Strategy を差し替えるだけで対応可能（拡張性あり）
