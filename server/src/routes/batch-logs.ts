import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import type { BatchRunLogRepository } from "../persistence/batchRunLogRepository.js";

export function createBatchLogsRouter(batchRunLogRepository: BatchRunLogRepository): Router {
  const router = Router();

  router.get("/", requireAuth, async (_req, res, next) => {
    try {
      const logs = await batchRunLogRepository.listRecent(50);
      res.json(logs);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
