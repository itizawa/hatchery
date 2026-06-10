import { NotFoundError, VoteRequestSchema } from "@hatchery/common";
import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { CommentRepository } from "../persistence/commentRepository.js";
import type { PostRepository } from "../persistence/postRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";

/**
 * /api/posts・/api/comments ルータ。
 * スレッド（post + comments）の取得、up/down vote を担う。ADR-0019 / ADR-0025。
 * - 読み取りは認証不要
 * - vote は認証必須（ADR-0025: up/down 両対応、toggle/switch）
 */
export function createPostsRouter(
  postRepo: PostRepository,
  commentRepo: CommentRepository,
  voteRepo: VoteRepository,
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
        return commentRepo.listByPost(postId).then((comments) => {
          res.status(200).json({ post, comments });
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
          return voteRepo
            .vote(userId, "post", postId, direction)
            .then(({ scoreDelta }) => postRepo.addScore(postId, scoreDelta))
            .then((updated) => {
              res.status(200).json(updated);
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
          return voteRepo
            .vote(userId, "comment", commentId, direction)
            .then(({ scoreDelta }) => commentRepo.addScore(commentId, scoreDelta))
            .then((updated) => {
              res.status(200).json(updated);
            });
        })
        .catch(next);
    },
  );

  return router;
}
