# Issue #536 設計書: `req.user!` 非 null assertion を型付きヘルパーで解消する

## 背景・目的

認証必須ルートで `const userId = req.user!.id;` という非 null assertion が 5 箇所
（`auth.ts:38`・`communities.ts:114,132`・`posts.ts:60,90`）で散在している。
`requireAuth` 通過後は `req.user` が必ず存在するが、Express の型上は `User | undefined`
のままで `!` が型を握り潰している。これを型付きヘルパーで解消する。

## 受け入れ条件（テストに落とす入出力）

1. 認証済みリクエストから `AuthUser` を取り出すヘルパー `getAuthUser(req): AuthUser` を追加。
   未認証（`req.user` が undefined）時は `UnauthorizedError` を投げる。
2. `auth.ts`・`communities.ts`・`posts.ts` の `req.user!` 5 箇所をヘルパー経由に置き換え、
   `!` を撤去する。
3. ヘルパーの単体テスト（user あり / なし）を追加する。
4. `pnpm turbo run build test lint` が緑。`no-non-null-assertion` 相当の緩みを増やさない。

## 設計判断

- **配置**: `server/src/middleware/getAuthUser.ts`。`requireAuth.ts` と同じ middleware
  ディレクトリに置く（認証コンテキストの取り出しは認証関連責務）。middleware 関数ではなく
  純粋なヘルパー関数なのでファイル名は責務を表す `getAuthUser`。
- **シグネチャ**: `getAuthUser(req: Pick<Request, "user">): AuthUser`。
  `req.user`（`Express.User extends AuthUser`）が truthy ならそれを返し、
  falsy なら `throw new UnauthorizedError()`。
  - `Pick<Request, "user">` にすることでテストのモックを最小化でき、呼び出し側は
    `Request` 全体を渡せるので互換。
- **戻り値型**: Express の `Express.User`（= `AuthUser` を extends した空 interface）。
  共通型 `AuthUser` として返すため、内部で `req.user` をそのまま返す。
- **例外**: 既存の `@hatchery/common` の `UnauthorizedError`（statusCode 401）を再利用。
  `requireAuth` と同じ例外型で一貫させ、`errorHandler` がそのまま 401 にマップする。
- **置き換え**: 各ルートで `const userId = req.user!.id;` → `const userId = getAuthUser(req).id;`。
  `requireAuth` を通っているルートのみなので実挙動は不変（型安全化のみ）。

## スコープ外

- crypto.ts / postRepository.ts の非 null assertion（#475 で対応）。

## ユーザー可視の振る舞い

変わらない（型安全化の内部リファクタ。`requireAuth` 通過後の挙動は同一）。
よって `e2e/` ユースケースの更新は不要。
