import { HomeFeedQuerySchema } from "@hatchery/common";
import { Router } from "express";

import type { CommentRepository } from "../persistence/commentRepository.js";
import type { PostRepository } from "../persistence/postRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import { attachAuthorWorker } from "./authorWorker.js";
import { attachCommentCount } from "./commentCount.js";
import { extractSessionId } from "./extractSessionId.js";
import { toPostResponse } from "./postResponse.js";

/**
 * /api/feed ルータ。ホームフィード（全 community の post を新着順で返す公開フィード）。
 * ADR-0019 / ADR-0020 更新: 購読フィルタなし・認証不要。#367 カーソルページネーション対応。
 * #479: 各 post に発言者の表示用ワーカー情報（author_worker）を付与する。
 * #831: sessionId クエリパラメータ付きのとき my_vote を付与する。
 */
export function createFeedRouter({
  postRepo,
  workerRepo,
  commentRepo,
  voteRepo,
}: {
  postRepo: PostRepository;
  workerRepo: WorkerRepository;
  commentRepo: CommentRepository;
  voteRepo: VoteRepository;
}): Router {
  const router = Router();

  // eslint-disable-next-line max-params
  router.get("/", (req, res, next) => {
    const parsed = HomeFeedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", issues: parsed.error.issues });
      return;
    }
    const { cursor, limit, sort } = parsed.data;
    // sessionId は任意クエリパラメータ。UUID 検証付きで取得し、不正・未指定は null（#831）。
    const sessionId = extractSessionId(req);

    // reveal フィルタ（#556）: createdAt <= now のもののみ公開する。
    const now = new Date();
    const fetchPage =
      sort === "popular"
        ? postRepo.listPopularPaged(cursor, limit, { now })
        : postRepo.listLatestPaged(cursor, limit, { now });

    fetchPage
      .then(async (result) => {
        const enriched = await attachAuthorWorker(result.posts, workerRepo);
        // 各 post にコメント件数を付与する（N+1 回避・#500）。
        const withCounts = await attachCommentCount(enriched, commentRepo);
        // sessionId があれば投票状態を一括取得して付与する（#831）。
        if (sessionId) {
          const voteMap = await voteRepo.findVotesBySessionAndTargets({
            sessionId,
            targetType: "post",
            targetIds: withCounts.map((p) => p.id),
          });
          const posts = withCounts.map((p) => toPostResponse({ ...p, myVote: voteMap.get(p.id) ?? null }));
          res.status(200).json({ ...result, posts });
        } else {
          // OpenAPI 契約（snake_case）へ整形して返す（#499）。
          const posts = withCounts.map(toPostResponse);
          res.status(200).json({ ...result, posts });
        }
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
