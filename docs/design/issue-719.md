# Issue #719 設計書: health エンドポイントの異常系テスト追加

## 背景・目的

`server/src/routes/health.ts` は現在 `GET /health` に対して常に `200 { status: "ok" }` を返すだけの実装であり、DB 接続などの外部依存はない。

Issue #719 では「DB 接続に依存するヘルスチェックロジックがある場合、DB 接続失敗時の挙動（503 等）がテストで保護されていない」と指摘されている。現在の実装を精査した結果、**DB ヘルスチェックの仕組みが存在しないこと自体**が問題であることが判明した。

本設計では以下を行う：

1. `health.ts` を拡張し、DB 疎通確認（`healthCheck` 関数）の依存注入に対応させる
2. 正常系（DB 正常）・異常系（DB 失敗・タイムアウト）のテストを追加する

## 実装方針

### health.ts の拡張

現行の `healthRouter` は `createApp` に直接インポートされているが、DB ヘルスチェックを依存注入可能にするため、ファクトリ関数パターンに変更する：

```ts
// 変更前
export const healthRouter: Router = Router();
healthRouter.get("/", (_req, res) => { res.status(200).json({ status: "ok" }); });

// 変更後
export type HealthChecker = () => Promise<void>;

export function createHealthRouter(healthCheck?: HealthChecker): Router {
  const router = Router();
  router.get("/", async (_req, res, next) => {
    if (healthCheck) {
      try {
        await healthCheck();
      } catch (err) {
        res.status(503).json({ status: "error", message: "service unavailable" });
        return;
      }
    }
    res.status(200).json({ status: "ok" });
  });
  return router;
}
```

### app.ts の変更

`healthRouter` を `createHealthRouter()` （引数なし）で置き換える。本番では `AppDeps` に `healthCheck` を追加して Prisma の `$queryRaw` 等を渡すことも可能だが、今回は最小変更とし、`healthCheck` なし（常時 200）のデフォルト動作を維持する。

### テスト追加内容

| ケース | 期待ステータス | 期待ボディ |
|---|---|---|
| healthCheck 未指定（既存正常系）| 200 | `{ status: "ok" }` |
| healthCheck が正常に解決する | 200 | `{ status: "ok" }` |
| healthCheck が例外をスローする | 503 | `{ status: "error", message: "service unavailable" }` |
| healthCheck が Rejected Promise を返す | 503 | `{ status: "error", message: "service unavailable" }` |

## 受け入れ条件との対応

1. ✅ `health.ts` 実装を読み全分岐を洗い出した（→ 分岐が存在しないため実装を拡張する）
2. ✅ 異常系テストを追加する（DB 接続失敗時 503 等）
3. ✅ 既存の正常系テスト（200 を返す）は保持する
4. ✅ `pnpm --filter @hatchery/server test` が全件グリーン
5. ✅ `pnpm turbo run lint` がグリーン

## 影響範囲

- `server/src/routes/health.ts`（ファクトリ関数に変更）
- `server/src/app.ts`（`healthRouter` → `createHealthRouter()` に変更）
- `server/src/routes/health.test.ts`（異常系テスト追加）
