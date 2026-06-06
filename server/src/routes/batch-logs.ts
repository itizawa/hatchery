import { Router } from "express";

import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { BatchRunLogRepository } from "../persistence/batchRunLogRepository.js";

export function createBatchLogsRouter(batchRunLogRepository: BatchRunLogRepository): Router {
  const router = Router();

  // #136: /admin/batch-logs は admin ロール必須。requireAuth → requireAdmin の順で適用する。
  router.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      const logs = await batchRunLogRepository.findRecent(50);
      res.json(logs);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
