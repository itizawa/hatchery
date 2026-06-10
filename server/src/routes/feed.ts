import { Router } from "express";

import type { PostRepository } from "../persistence/postRepository.js";

/**
 * /api/feed ルータ。ホームフィード（全 community の post を新着順で返す公開フィード）。
 * ADR-0019 / ADR-0020 更新: 購読フィルタなし・認証不要。
 */
export function createFeedRouter(postRepo: PostRepository): Router {
  const router = Router();

  // ホームフィード（公開・全 community の post・新着順）
  router.get("/", (req, res, next) => {
    postRepo
      .listLatest()
      .then((posts) => res.status(200).json(posts))
      .catch(next);
  });

  return router;
}
