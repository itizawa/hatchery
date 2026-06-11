# Issue #375: passport 認証設定 (server/src/auth/passport.ts) のテストを追加する

- Issue: https://github.com/itizawa/hatchery/issues/375
- 種別: test（テスト追加のみ。プロダクションコードの変更なし）
- 関連: ADR-0010（ID/パスワード認証）、#343（Google OAuth 追加予定）

## 背景 / 目的

`server/src/auth/passport.ts` の `createPassport`（local Strategy の verify・`serializeUser` / `deserializeUser`）は
`routes/auth.test.ts` のログインフロー経由でしか検証されておらず、直接の単体テストがない。
#343 で `createPassport` に Strategy を追記する前に、回帰の土台となるユニットテストを固める。

## 方針

`server/src/auth/passport.test.ts` を新規追加する。DB 非依存とするため、
`persistence/userRepository.ts` の `createInMemoryUserRepository`（インメモリ実装）に
`bcrypt.hash`（テスト高速化のため rounds=4）で生成した実ハッシュを持つユーザーを投入して注入する。

### local Strategy verify の検証方法

private な内部（`_strategies` / `_verify`）には触れず、**公開 API の `p.authenticate("local", callback)`** が返す
ミドルウェアに `body: { loginId, password }` を持つ最小限のリクエストスタブを渡して実行し、
カスタムコールバックで `(err, user)` を受け取る。Express サーバの起動は不要。

### serializeUser / deserializeUser の検証方法

passport の `Authenticator` は `serializeUser(user, done)` / `deserializeUser(id, done)` の
「実行形」も持つ（登録形と同一メソッドの多重定義）。`@types/passport` は登録形しか公開しないため、
テスト内でのみ実行形のシグネチャへ型キャストして呼び出す。

## テストケース（受け入れ条件との対応）

| # | ケース | 期待値 |
|---|--------|--------|
| 1 | 正しい loginId / password | verify が `AuthUser`（id / loginId / displayName / role）を返す。`passwordHash` を含まない |
| 2 | 存在しない loginId | `user === false`・`err` なし |
| 3 | パスワード不一致 | `user === false`・`err` なし |
| 4 | リポジトリが throw | `err` に伝播する |
| 5 | `serializeUser` | `user.id` がそのまま識別子になる |
| 6 | `deserializeUser`（存在する id） | `AuthUser` に解決される |
| 7 | `deserializeUser`（存在しない id） | `false` が返る（エラーなし） |
| 8 | `toAuthUser` | avatarUrl あり/なしの写像が正しい |

## 制約遵守

- `server → common` の一方向 import 境界を守る（common の型 `AuthUser` のみ参照）。
- DB・Express 起動に依存しない純粋なユニットテスト。
- プロダクションコードは変更しない。
