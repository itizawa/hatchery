# 設計書: 招待リンクの受諾（新規ユーザー登録）画面を実装する (#134)

## 1. 目的 / 背景

#132 で実装した招待トークン検証 API（`GET /api/invitations/:token`）と受諾 API
（`POST /api/invitations/:token/accept`）を使い、招待リンクを開いた人が実際に
新規ユーザー登録できる公開ルート `/invite/:token` を client に追加する。

## 2. スコープ（やること / やらないこと）

### やること
- 公開ルート `/invite/$token` を TanStack Router に追加する（`requireAuth` なし）
- `AcceptInvitationScene` コンポーネントを実装する
- `client/src/api/invitations.ts` に `useInvitation` / `useAcceptInvitation` を追加する
- トークン状態に応じた表示の出し分け（フォーム or エラーメッセージ）
- ログイン済みユーザーが開いた場合は `/` へリダイレクト
- 各入力欄に `inputProps={{ maxLength: N }}` で二重防御（CLAUDE.md #91）
- `AppShell` の AuthLayout 検出を `/invite/` プレフィックスにも対応させる
- `common/src/domain/invitation/invitation.ts` に `AcceptInvitation` 用の named export 定数を追加する

### やらないこと
- 招待 API 本体（#132 で実装済み）
- 管理者向け招待管理 UI（#133 で実装済み）
- パスワード強度メーター・メール確認などの拡張

## 3. 受け入れ条件（テストに落とせる粒度）

1. 公開ルート `/invite/:token` が追加されており、未ログインでも開ける（`requireAuth` なし）
2. `useInvitation` / `useAcceptInvitation` が `openApiClient` 経由で実装されている
3. トークンが `active` のとき → **登録フォーム**（ログイン ID / 表示名 / パスワード）が表示される
4. トークンが `used/expired/revoked` のとき → フォームを出さず、状態に応じたメッセージと `/login` 導線を表示する
5. トークンが存在しない（404 等）→ フォームを出さず、「無効な招待リンク」メッセージと `/login` 導線
6. フォーム送信 → 受諾 API を呼び、成功時は `AUTH_ME_QUERY_KEY` を invalidate して `/` へ遷移する
7. ID 重複（409）→「このIDは既に使われています」エラーメッセージを表示する
8. 受諾中に招待が無効化（409/410）→「招待リンクが無効になりました」メッセージを表示する
9. 各入力にフロント側の文字数上限が掛かっている（id: 50 / displayName: 100 / password: 100）
10. ログイン済みで開いた場合は `/` へリダイレクトする

## 4. 設計方針

### 公開ルートの出し分け（AuthLayout）

`AppShell` は現在 `AUTH_PATHS = ["/login"]` の**完全一致**で AuthLayout を選んでいる。
`/invite/$token` は動的パスのため、**プレフィックス一致**に変更が必要。

変更方針:
```tsx
// 旧: AUTH_PATHS の exact match
// 新: AUTH_PATH_PREFIXES の startsWith check（/login も /invite/ も包含）
const AUTH_PATH_PREFIXES = ["/login", "/invite/"] as const;
if (AUTH_PATH_PREFIXES.some(p => pathname.startsWith(p))) return <AuthLayout />;
```

この変更は `/login` も `startsWith("/login")` で正しく動作する。

### API 関数の設計

```ts
// GET /api/invitations/{token} → InvitationPublic | null（404 なら null）
export async function fetchInvitation(token: string): Promise<InvitationPublic | null>

// POST /api/invitations/{token}/accept → AuthUser
export async function acceptInvitation(token: string, body: AcceptInvitation): Promise<AuthUser>

// React Query hooks
export function useInvitation(token: string)
export function useAcceptInvitation(token: string)
```

`fetchInvitation` は 404 の場合に `null` を返し、それ以外のエラーは `throw` する。
`acceptInvitation` は非 2xx 時に `ApiError(status, message)` を投げる（ステータスコードを呼び出し元で判定可能にする）。

### 無効トークン時の UX

トークンの状態（`InvitationStatus`）に応じてメッセージを分ける:

| 状態 | メッセージ |
|------|-----------|
| `null`（API 404） | 「このリンクは無効です」 |
| `used` | 「この招待リンクはすでに使用されています」 |
| `expired` | 「この招待リンクは有効期限が切れています」 |
| `revoked` | 「この招待リンクは無効化されています」 |

### 受諾後の遷移とログイン済み訪問時の扱い

- **受諾成功時**: `useAcceptInvitation` の `onSuccess` で `AUTH_ME_QUERY_KEY` を invalidate → `navigate({ to: "/" })`
- **ログイン済みアクセス**: `useAuth()` の結果が truthy な場合、`useEffect` で `/` へリダイレクト

### AcceptInvitation 定数の export

`common/src/domain/invitation/invitation.ts` に named 定数を追加し、
スキーマと client で一致させる（CLAUDE.md 規約）:

```ts
export const ACCEPT_INVITATION_ID_MAX_LENGTH = 50;
export const ACCEPT_INVITATION_DISPLAY_NAME_MAX_LENGTH = 100;
export const ACCEPT_INVITATION_PASSWORD_MAX_LENGTH = 100;
```

## 5. 影響範囲 / 既存への変更

| 対象 | 変更種別 |
|------|---------|
| `common/src/domain/invitation/invitation.ts` | 定数追加（named export）|
| `client/src/api/invitations.ts` | 関数・フック追加 |
| `client/src/api/invitations.test.ts` | テスト追加 |
| `client/src/routes/AcceptInvitationScene.tsx` | 新規作成 |
| `client/src/routes/AcceptInvitationScene.test.tsx` | 新規作成 |
| `client/src/router.tsx` | ルート追加・`AppShell` の auth path 検出変更 |

## 6. テスト計画（TDD で書くテスト一覧）

### `client/src/api/invitations.test.ts` の追加テスト

- `fetchInvitation`: GET /api/invitations/{token} を呼ぶ / 200 で InvitationPublic を返す / 404 で null を返す / その他非 2xx で例外
- `acceptInvitation`: POST /api/invitations/{token}/accept を呼ぶ / 201 で AuthUser を返す / 409 で ApiError(409) を投げる / 404 で例外

### `client/src/routes/AcceptInvitationScene.test.tsx`

- `/invite/valid-token` で activeなトークン → 登録フォームが表示される
- `/invite/used-token` → 「使用済み」メッセージが表示される、フォームなし
- `/invite/expired-token` → 「期限切れ」メッセージが表示される、フォームなし
- `/invite/revoked-token` → 「無効化済み」メッセージが表示される、フォームなし
- `/invite/404-token` → 「無効なリンク」メッセージが表示される、フォームなし
- フォーム送信 → acceptInvitation が呼ばれる、成功で / へ遷移
- ID 重複エラー（409）→ ID 重複エラーメッセージが表示される
- ログイン済みで開いた場合 → `/` へリダイレクト（ログイン画面ではなくホームへ）

## 7. リスク・未決事項

- `AcceptInvitation` のパスワードは `min(8)` があるため、フロント側でも min 検証を入れる（サーバとの二重防御）
- `openapi.gen.ts` は生成ファイルのため、テストは `vi.stubGlobal("fetch", ...)` で fetch をモック
