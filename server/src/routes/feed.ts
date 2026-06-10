import { HomeFeedQuerySchema } from "@hatchery/common";
import { Router } from "express";

import type { PostRepository } from "../persistence/postRepository.js";

/**
 * /api/feed ルータ。ホームフィード（全 community の post を新着順で返す公開フィード）。
 * ADR-0019 / ADR-0020 更新: 購読フィルタなし・認証不要。#367 カーソルページネーション対応。
 */
export function createFeedRouter(postRepo: PostRepository): Router {
  const router = Router();

  router.get("/", (req, res, next) => {
    const parsed = HomeFeedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", issues: parsed.error.issues });
      return;
    }
    const { cursor, limit } = parsed.data;

    postRepo
      .listLatestPaged(cursor, limit)
      .then((result) => res.status(200).json(result))
      .catch((err: unknown) => {
        if (err instanceof Error && err.message === "INVALID_CURSOR") {
          res.status(400).json({ error: "ValidationError", issues: [{ message: "カーソルが不正です" }] });
          return;
        }
        next(err);
      });
  });

  return router;
}
