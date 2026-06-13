# 設計書: APP_SECRET のハードコードされたデフォルトシークレットを廃止し本番で必須化する (#418)

## 1. 目的 / 背景

`server/src/utils/crypto.ts:7` が AES-256-GCM の暗号鍵導出に使う `APP_SECRET` を `process.env` から直読みし、未設定時はハードコードされたフォールバック `"hatchery-dev-secret"` を使っている。

本番環境で `APP_SECRET` を設定し忘れても起動してしまい、リポジトリに公開されている既知のシークレットで API キーが暗号化される。`SESSION_SECRET` は #344 で本番必須化済みであり、`APP_SECRET` も同水準の扱いにする。

## 2. スコープ（やること / やらないこと）

**やること:**
- `APP_SECRET` を `EnvSchema` / `ServerEnv` に追加（optional）
- `crypto.ts` の `process.env.APP_SECRET` 直読みを解消し、本番チェック付き `resolveAppSecret` 関数を追加
- テストで3ケースを検証

**やらないこと:**
- 鍵ローテーション・既存暗号文の再暗号化マイグレーション
- その他の `process.env` 直読み解消（それは Issue #419 のスコープ）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `NODE_ENV=production` + `APP_SECRET` 未設定 → `resolveAppSecret` が明確なエラーを投げる
2. `NODE_ENV=production` + `APP_SECRET` 設定済み → 正常にシークレットを返す
3. 非 production + `APP_SECRET` 未設定 → `"hatchery-dev-secret"` フォールバックを返す
4. `APP_SECRET` が `EnvSchema` / `ServerEnv.appSecret` に追加されている
5. `pnpm test:repo` / `pnpm lint` が緑

## 4. 設計方針

### `env.ts` の変更

```ts
// EnvSchema に追加
APP_SECRET: z.string().min(1).optional(),

// ServerEnv に追加
appSecret: string | undefined;

// loadEnv の return に追加
appSecret: parsed.APP_SECRET,
```

### `crypto.ts` の変更

```ts
/**
 * APP_SECRET を解決する。
 * production で未設定なら明確なエラーを投げる。
 * それ以外で未設定なら開発用フォールバックを返す。
 */
export function resolveAppSecret(source: NodeJS.ProcessEnv = process.env): string {
  const secret = source.APP_SECRET;
  if (!secret) {
    if (source.NODE_ENV === "production") {
      throw new Error("APP_SECRET 環境変数が設定されていません。本番環境では必須です（#418）。");
    }
    return "hatchery-dev-secret";
  }
  return secret;
}

// getKey() の変更
function getKey(): Buffer {
  const secret = resolveAppSecret();
  return createHash("sha256").update(secret).digest();
}
```

`resolveAppSecret` を export することでテストから直接検証可能にする。
既存の `encrypt`/`decrypt` のシグネチャは変更しない（callers への影響ゼロ）。

## 5. 影響範囲

- `server/src/config/env.ts` — `EnvSchema`, `ServerEnv`, `loadEnv`
- `server/src/utils/crypto.ts` — `resolveAppSecret` 追加、`getKey` 修正
- `server/src/config/env.test.ts` — `appSecret` の新テスト追加
- `server/src/utils/crypto.test.ts` — `resolveAppSecret` の3ケーステスト追加

## 6. テスト計画

**`server/src/utils/crypto.test.ts` の追加テスト:**
- `resolveAppSecret`: production + 未設定 → throw
- `resolveAppSecret`: production + 設定済み → 設定値を返す
- `resolveAppSecret`: 非 production + 未設定 → "hatchery-dev-secret"

**`server/src/config/env.test.ts` の追加テスト:**
- `APP_SECRET` 設定済み → `appSecret` として返す
- `APP_SECRET` 未設定 → `appSecret` が undefined

## 7. リスク・未決事項

- 既存の `encrypt`/`decrypt` テストは `APP_SECRET` 未設定で動作しているが、非 production 環境（vitest）なのでフォールバックが効き引き続き動作する
- `SESSION_SECRET` の本番チェックは `app.ts` 内で行うが、`APP_SECRET` は鍵使用時（`crypto.ts`）にチェックする。これは "または鍵使用時" という受け入れ条件に合致する
