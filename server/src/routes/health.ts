import { Router } from "express";

/** DB 疎通確認など任意のヘルスチェック関数。失敗時は例外/Rejected Promise を投げる。 */
export type HealthChecker = () => Promise<void>;

/**
 * ヘルスチェックルーターを生成する。
 * - healthCheck 未指定: 常に 200 { status: "ok" } を返す（後方互換）
 * - healthCheck 指定: 正常解決 → 200, 例外 → 503 { status: "error", message: "service unavailable" }
 */
export function createHealthRouter(healthCheck?: HealthChecker): Router {
  const router = Router();

  // eslint-disable-next-line max-params
  router.get("/", async (_req, res) => {
    if (healthCheck) {
      try {
        await healthCheck();
      } catch (err) {
        console.error("[health] healthCheck failed:", err);
        res.status(503).json({ status: "error", message: "service unavailable" });
        return;
      }
    }
    res.status(200).json({ status: "ok" });
  });

  return router;
}

/** デフォルトの healthRouter（healthCheck なし・後方互換）。 */
export const healthRouter = createHealthRouter();
