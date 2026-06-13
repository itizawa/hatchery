import { NotFoundError, VoteRequestSchema } from "@hatchery/common";
import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { CommentRepository } from "../persistence/commentRepository.js";
import type { PostRepository } from "../persistence/postRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import { buildAuthorWorkerEnricher } from "./authorWorker.js";

/**
 * /api/posts・/api/comments ルータ。
 * スレッド（post + comments）の取得、up/down vote を担う。ADR-0019 / ADR-0025。
 * - 読み取りは認証不要
 * - vote は認証必須（ADR-0025: up/down 両対応、toggle/switch）
 * - #479: スレッドの post / 各 comment に発言者の表示用ワーカー情報（author_worker）を付与する。
 */
export function createPostsRouter(
  postRepo: PostRepository,
  commentRepo: CommentRepository,
  voteRepo: VoteRepository,
  workerRepo: WorkerRepository,
): Router {
  const router = Router();

  // スレッド取得（post + comments・認証不要）
  router.get("/posts/:postId", (req, res, next) => {
    const { postId } = req.params as { postId: string };
    postRepo
      .findById(postId)
      .then((post) => {
        if (!post) {
          throw new NotFoundError("PostNotFound");
        }
        return commentRepo.listByPost(postId).then(async (comments) => {
          // post と comments を 1 回のワーカー取得で付与する（重複クエリを避ける）。
          const enrich = await buildAuthorWorkerEnricher(workerRepo);
          const [enrichedPost] = enrich([post]);
          const enrichedComments = enrich(comments);
          res.status(200).json({ post: enrichedPost, comments: enrichedComments });
        });
      })
      .catch(next);
  });

  // post への vote（認証必須・toggle/switch・ADR-0025）
  router.post(
    "/posts/:postId/vote",
    requireAuth,
    validateBody(VoteRequestSchema),
    (req, res, next) => {
      const { postId } = req.params as { postId: string };
      const userId = req.user!.id;
      const { direction } = req.body as { direction: "up" | "down" };

      postRepo
        .findById(postId)
        .then((post) => {
          if (!post) {
            throw new NotFoundError("PostNotFound");
          }
          // vote 記録と score 更新を単一の整合操作で行う（#453・AC7）。
          return voteRepo
            .voteAndApplyScore(userId, "post", postId, direction, (delta) =>
              postRepo.addScore(postId, delta).then((r) => r?.score ?? null),
            )
            .then(({ score }) => {
              res.status(200).json({ ...post, score: score ?? post.score });
            });
        })
        .catch(next);
    },
  );

  // comment への vote（認証必須・toggle/switch・ADR-0025）
  router.post(
    "/comments/:commentId/vote",
    requireAuth,
    validateBody(VoteRequestSchema),
    (req, res, next) => {
      const { commentId } = req.params as { commentId: string };
      const userId = req.user!.id;
      const { direction } = req.body as { direction: "up" | "down" };

      commentRepo
        .findById(commentId)
        .then((comment) => {
          if (!comment) {
            throw new NotFoundError("CommentNotFound");
          }
          // vote 記録と score 更新を単一の整合操作で行う（#453・AC7）。
          return voteRepo
            .voteAndApplyScore(userId, "comment", commentId, direction, (delta) =>
              commentRepo.addScore(commentId, delta).then((r) => r?.score ?? null),
            )
            .then(({ score }) => {
              res.status(200).json({ ...comment, score: score ?? comment.score });
            });
        })
        .catch(next);
    },
  );

  return router;
}
