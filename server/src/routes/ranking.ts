import { Router } from "express";
import { z } from "zod";

import type { VoteRepository } from "../persistence/voteRepository.js";

/** トレンド集計ウィンドウ（直近 7 日）。 */
const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const TRENDING_DEFAULT_LIMIT = 10;
const TRENDING_MAX_LIMIT = 20;

const TrendingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(TRENDING_MAX_LIMIT).optional(),
});

/**
 * ランキング画面右サイドバー用のトレンド Post/Comment API（#1065）。
 * `/ranking` の /:workerId と衝突しないよう workers ルータとは別系統（/api/ranking）にマウントする。
 */
export function createRankingRouter({ voteRepository }: { voteRepository: VoteRepository }): Router {
  const router = Router();

  // トレンド Post/Comment（認証不要・直近 7 日・#1065）。
  // eslint-disable-next-line max-params
  router.get("/trending", (req, res, next) => {
    const parsed = TrendingQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", issues: parsed.error.issues });
      return;
    }
    const { limit = TRENDING_DEFAULT_LIMIT } = parsed.data;
    const since = new Date(Date.now() - TRENDING_WINDOW_MS);
    voteRepository
      .trendingItemsSince({ since, limit })
      .then((items) => res.status(200).json({ items }))
      .catch(next);
  });

  return router;
}
