# 設計書: Passport の req.user 型を AuthUser に明示制限する (#69)

## 1. 目的 / 背景

`@types/passport` の `Express.User` はデフォルトで空インターフェース（`{}`）のため、`req.user` が実質的に `any` に近い型になっている。
ルートハンドラ内で `req.user as AuthUser` の不安全なキャストが複数箇所に存在しており、レスポンス形状のドリフトを型で検知できない。

`declare global { namespace Express { interface User extends AuthUser {} } }` によるグローバル型拡張で `req.user` を `AuthUser | undefined` として扱えるようにし、不安全キャストを除去する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `server/src/types/express.d.ts` を新規作成し、`Express.User extends AuthUser` の型拡張を定義する
- `req.user as AuthUser` キャストを含む全ルートハンドラを修正する
- `(user as { id: string }).id` キャストを `user.id` に置き換える

**やらないこと:**
- `common` / `client` への変更
- ランタイム挙動の変更（型定義のみ）
- 新規 API エンドポイントの追加

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `Express.User` が `AuthUser` の全フィールド（`id`, `displayName`, `employeeId?`, `avatarUrl?`）を持つよう型拡張されている
- `req.user` を参照する全箇所で `as AuthUser` キャストが除去されている（grep で確認）
- `req.user` を参照する全箇所で `any` へのキャストが除去されている
- `requireAuth` 通過後のハンドラで `req.user!` で正しく型推論できる（`tsc --noEmit` でエラーなし）
- 既存テスト（`pnpm --filter @hatchery/server test`）が全て通る
- lint（`pnpm --filter @hatchery/server lint`）が通る
- `tsc --noEmit` でコンパイルエラーがゼロ

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 型拡張ファイルの配置

`server/src/types/express.d.ts` を作成。`tsconfig.json` の `include: ["src/**/*.ts"]` により自動的にコンパイル対象となる。

```typescript
// server/src/types/express.d.ts
import type { AuthUser } from "@hatchery/common";

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}
```

`import` があるため「モジュール」扱いになり、`declare global` でグローバル名前空間を拡張する。
`export {}` は不要（`import type` で既にモジュールとして扱われる）。

### 各ファイルの変更方針

| ファイル | 変更前 | 変更後 |
|--------|--------|--------|
| `routes/auth.ts` | `(req.user as AuthUser).id` | `req.user!.id` |
| `routes/channels.ts` | `req.user as AuthUser` | `req.user!` |
| `routes/employees.ts` | `req.user as { employeeId: string \| null }` | `req.user!` |
| `auth/passport.ts` | `(user as { id: string }).id` | `user.id` |

`requireAuth` 通過後のハンドラでは `req.user!` を使用（非 null アサーション）。
型は `AuthUser` と正しく推論されるため、`as AuthUser` のような不安全キャストより安全。

### 境界制約（ADR-0001/0005）

`AuthUser` は `common/` で定義済み。`server → common` の一方向依存（ADR-0001）を維持。
`common/` に Express や Node 固有の型は一切追加しない（ADR-0005）。

## 5. 影響範囲 / 既存への変更

対象ワークスペース: **server のみ**

変更ファイル:
- `server/src/types/express.d.ts`（新規）
- `server/src/routes/auth.ts`（`as AuthUser` 除去）
- `server/src/routes/channels.ts`（`as AuthUser` 除去）
- `server/src/routes/employees.ts`（不安全キャスト除去）
- `server/src/auth/passport.ts`（`(user as { id: string })` 除去）

## 6. テスト計画（TDDで書くテスト一覧）

型定義のみの変更のため追加テスト不要（Issue #69 AC に明記）。
検証は以下で行う:
- `tsc --noEmit`（コンパイルエラーゼロを確認）
- 既存テスト `pnpm --filter @hatchery/server test`
- lint `pnpm --filter @hatchery/server lint`

## 7. リスク・未決事項

- `module: "nodenext"` + `verbatimModuleSyntax` 環境での `.d.ts` グローバル拡張の動作確認が必要
- `employees.ts` の `string | null` → `string | undefined` の微妙な型差異: `undefined !== id` の評価は `null !== id` と同じ挙動のため実害なし
