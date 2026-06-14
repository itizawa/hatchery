import { HomeFeedQuerySchema } from "@hatchery/common";
import { Router } from "express";

import type { PostRepository } from "../persistence/postRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import { attachAuthorWorker } from "./authorWorker.js";
import { toPostResponse } from "./postResponse.js";

/**
 * /api/feed ルータ。ホームフィード（全 community の post を新着順で返す公開フィード）。
 * ADR-0019 / ADR-0020 更新: 購読フィルタなし・認証不要。#367 カーソルページネーション対応。
 * #479: 各 post に発言者の表示用ワーカー情報（author_worker）を付与する。
 */
export function createFeedRouter(postRepo: PostRepository, workerRepo: WorkerRepository): Router {
  const router = Router();

  router.get("/", (req, res, next) => {
    const parsed = HomeFeedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", issues: parsed.error.issues });
      return;
    }
    const { cursor, limit, sort } = parsed.data;

    const fetchPage =
      sort === "popular"
        ? postRepo.listPopularPaged(cursor, limit)
        : postRepo.listLatestPaged(cursor, limit);

    fetchPage
      .then(async (result) => {
        const enriched = await attachAuthorWorker(result.posts, workerRepo);
        // OpenAPI 契約（snake_case）へ整形して返す（#499）。
        const posts = enriched.map(toPostResponse);
        res.status(200).json({ ...result, posts });
      })
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
