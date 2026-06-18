# 設計書: AuthUserSchema の displayName と avatarUrl に .max() を追加する (#714)

## 1. 目的 / 背景

`common/src/domain/auth/auth.ts` の `AuthUserSchema` には `displayName` と `avatarUrl` に `.max()` バリデーションが欠落している（#91 規約違反）。
定数 `DISPLAY_NAME_MAX_LENGTH = 100` / `AVATAR_URL_MAX_LENGTH = 2048` は同ファイルで既に定義済み。
`UpdateProfileSchema` では両フィールドに `.max()` を正しく設定済みであり、`AuthUserSchema` だけが取り残された状態。

## 2. スコープ（やること / やらないこと）

やること:
- `AuthUserSchema` の `displayName` に `.max(DISPLAY_NAME_MAX_LENGTH)` を追加
- `AuthUserSchema` の `avatarUrl` に `.max(AVATAR_URL_MAX_LENGTH)` を追加
- 境界値テストを `auth.test.ts` に追加

やらないこと:
- `UpdateProfileSchema` の変更（既に規約準拠）
- OpenAPI スペック（openapi.json）の更新（デュアルインスタンス Zod の制約により maxLength は OAS に現れないため不要）
- 他のスキーマファイルの変更

## 3. 受け入れ条件（テストに落とせる粒度）

- `AuthUserSchema` で `displayName` が 100 文字ちょうどのとき success
- `AuthUserSchema` で `displayName` が 101 文字のとき failure
- `AuthUserSchema` で `avatarUrl` が `AVATAR_URL_MAX_LENGTH` 文字ちょうどのとき success
- `AuthUserSchema` で `avatarUrl` が `AVATAR_URL_MAX_LENGTH + 1` 文字のとき failure
- 既存テストが引き続き全 pass

## 4. 設計方針

最小変更: `AuthUserSchema` の 2 フィールドに `.max(定数)` を追加するだけ。
定数は既にファイル上部で宣言済みのためインポート等は不要。

## 5. 影響範囲 / 既存への変更

- `common/src/domain/auth/auth.ts`（変更）: 2 行変更
- `common/src/domain/auth/auth.test.ts`（変更）: テスト追加
- `server/openapi.json` / `openapi.baseline.json`: デュアルインスタンス Zod の制約により変更なし

## 6. テスト計画

`auth.test.ts` に `describe("AuthUserSchema .max() バリデーション (#714)")` を追加:
- displayName が DISPLAY_NAME_MAX_LENGTH 文字ちょうどは有効
- displayName が DISPLAY_NAME_MAX_LENGTH + 1 文字は reject する
- avatarUrl が AVATAR_URL_MAX_LENGTH 文字ちょうどは有効
- avatarUrl が AVATAR_URL_MAX_LENGTH + 1 文字は reject する

## 7. リスク・未決事項

特になし。変更箇所が局所的で影響範囲が明確。
