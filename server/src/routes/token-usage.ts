import { Router } from "express";

import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { TokenUsageLogRepository } from "../persistence/tokenUsageLogRepository.js";

export function createTokenUsageRouter(tokenUsageLogRepository: TokenUsageLogRepository): Router {
  const router = Router();

  // GET /api/admin/token-usage は admin ロール必須。requireAuth → requireAdmin の順で適用する（#136）。
  router.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      const [logs, summary] = await Promise.all([
        tokenUsageLogRepository.findRecent(50),
        tokenUsageLogRepository.summarize(),
      ]);
      res.json({ logs, summary });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
