# 設計書: 認証基盤: ID/Password ログイン（Passport.js / セッション cookie）と未ログイン時の設定画面ガード (#26)

## 1. 目的 / 背景

Hatchery に認証の仕組みが無く誰でも全画面を開ける状態になっている。
観察者がログインできる最小の認証基盤を用意し、ログインしていない人が設定画面（#25）を開けないようにする。

## 2. スコープ（やること / やらないこと）

**やること**:
- ADR-0009: ID/Password 認証方式の決定を記録
- common: `LoginRequestSchema`（id/password Zod スキーマ）と `AuthUser` 型の追加
- server: User モデル（Prisma）+ Passport.js + express-session による認証基盤
  - `POST /auth/login` / `POST /auth/logout` / `GET /auth/me` エンドポイント
  - `requireAuth` ミドルウェア（未ログインは 401）
  - 開発環境向けシード（テストユーザー）
- client: ログイン画面 + 認証状態 TanStack Query + 設定画面（/settings）ガード

**やらないこと**:
- 設定画面そのものの実装（#25 で対応）
- サインアップ / パスワードリセット / メール確認
- OAuth / SSO / JWT / 多要素認証
- 認可（ロール / 権限）の細分化
- 本番セッションストア選定

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

### common
- `LoginRequestSchema` が `{ id: string(min1), password: string(min1) }` を正しく検証する
- 空文字・欠落フィールドで `safeParse` が失敗する
- `AuthUser` 型が `id` / `displayName` を持ちパスワードを含まない

### server
- `prisma migrate dev` で User モデル（id / displayName / passwordHash）が作成される
- `POST /auth/login` で正しい資格情報を送ると 200 + Set-Cookie が返る
- `POST /auth/login` で間違った資格情報を送ると 401 が返る
- `GET /auth/me` でセッション cookie を送ると 200 + AuthUser JSON が返る
- `GET /auth/me` でセッション cookie 無し / 無効だと 401 が返る
- `POST /auth/logout` でセッションが破棄され、以後 `GET /auth/me` が 401 になる
- `requireAuth` ミドルウェアが未ログインリクエストに 401 を返す
- 保護されたルートに認証済みリクエストが届く
- パスワードは bcrypt でハッシュ化・照合する（平文照合しない）

### client
- 未ログイン状態で `/settings` にアクセスするとログイン画面へリダイレクトされる
- ログイン済み状態で `/settings` にアクセスすると設定画面が表示される（またはリダイレクトされない）
- ログインフォームから `POST /auth/login` を呼び出し、成功するとホームへ遷移する
- ログアウト操作で `POST /auth/logout` を呼び出し、認証状態がクリアされる

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### ADR
`docs/adr/0009-authentication-password-passport.md` を新規作成。

### common
```
common/src/domain/auth.ts
  - LoginRequestSchema: z.object({ id: z.string().min(1), password: z.string().min(1) })
  - AuthUserSchema: z.object({ id: z.string(), displayName: z.string() })
  - type LoginRequest = z.infer<typeof LoginRequestSchema>
  - type AuthUser = z.infer<typeof AuthUserSchema>
common/src/domain/auth.test.ts
```

### server - Prismaモデル
```prisma
model User {
  id           String @id
  displayName  String
  passwordHash String
}
```

### server - 依存パッケージ
```
passport, passport-local, express-session, bcrypt
@types/passport, @types/passport-local, @types/express-session, @types/bcrypt
```

### server - ファイル構成
```
server/src/auth/
  passport.ts       # passportLocalStrategy 設定
server/src/middleware/
  requireAuth.ts    # 未ログイン 401 ミドルウェア
server/src/routes/
  auth.ts           # POST /auth/login, POST /auth/logout, GET /auth/me
server/src/routes/
  auth.test.ts      # supertest による結合テスト
server/prisma/seed.ts  # 開発環境用テストユーザーシード
```

### server - セッション設定
- `express-session` で cookie ベースセッション（`httpOnly: true`, `sameSite: 'lax'`）
- `SESSION_SECRET` 環境変数でシークレット設定（開発時はデフォルト値）
- `maxAge`: 24 時間

### client - ファイル構成
```
client/src/routes/
  LoginScene.tsx            # ログインフォーム
client/src/hooks/
  useAuth.ts                # GET /auth/me TanStack Query フック
```

### client - ルーターガード
- `/settings` ルートに `beforeLoad` を追加し、`GET /auth/me` が 401 の場合は `/login` へリダイレクト
- ログイン成功後は元のパスへリダイレクト（なければ `/` へ）

## 5. 影響範囲 / 既存への変更

- **common**: `auth.ts` 追加・`index.ts` にエクスポート追加
- **server**: `prisma/schema.prisma`（User モデル追加）、`app.ts`（session/passport 組み込み）、`routes/auth.ts`（新規）、`middleware/requireAuth.ts`（新規）、`prisma/seed.ts`（新規）
- **client**: `router.tsx`（/settings・/login ルート追加）、`routes/LoginScene.tsx`（新規）、`hooks/useAuth.ts`（新規）

## 6. テスト計画（TDD で書くテスト一覧）

1. `common/src/domain/auth.test.ts`:
   - `LoginRequestSchema` 正常パース
   - `LoginRequestSchema` 空文字 id → fail
   - `LoginRequestSchema` 欠落 password → fail
   - `AuthUserSchema` 正常パース

2. `server/src/routes/auth.test.ts`:
   - `POST /auth/login` 正常 → 200 + Set-Cookie
   - `POST /auth/login` 不正パスワード → 401
   - `POST /auth/login` バリデーション失敗（空フィールド）→ 400
   - `GET /auth/me` セッションあり → 200 + AuthUser
   - `GET /auth/me` セッションなし → 401
   - `POST /auth/logout` → セッション破棄 → 以後 GET /auth/me が 401

3. `client/src/routes/LoginScene.test.tsx`:
   - 未ログイン状態で `/settings` アクセス → `/login` にリダイレクト
   - ログイン済み状態で `/settings` アクセス → リダイレクトしない
   - フォーム送信 → login API 呼び出し

## 7. リスク・未決事項

- Issue #25（設定画面）未実装のため `/settings` ルートは placeholder コンポーネントで実装する
- セッションストアはデフォルトのメモリストア（本番では Redis 等が必要だが MVP スコープ外）
- `SESSION_SECRET` は環境変数で管理（開発時はデフォルト値を使用）
