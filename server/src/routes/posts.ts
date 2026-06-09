import { ConflictError, NotFoundError } from "@hatchery/common";
import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import type { CommentRepository } from "../persistence/commentRepository.js";
import type { PostRepository } from "../persistence/postRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";

/**
 * /api/posts・/api/comments ルータ。
 * スレッド（post + comments）の取得、up vote を担う。ADR-0019 / ADR-0020。
 * - 読み取りは認証不要
 * - up vote は認証必須（ユーザーは消費者として up vote のみ・ADR-0020）
 * - 二重投票は 409 を返す
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

  // post への up vote（認証必須・二重投票防止・ADR-0020）
  router.post("/posts/:postId/vote", requireAuth, (req, res, next) => {
    const { postId } = req.params as { postId: string };
    const userId = req.user!.id;

    postRepo
      .findById(postId)
      .then((post) => {
        if (!post) {
          throw new NotFoundError("PostNotFound");
        }
        return voteRepo.hasVoted(userId, "post", postId).then((alreadyVoted) => {
          if (alreadyVoted) {
            throw new ConflictError("AlreadyVoted");
          }
          return voteRepo
            .create(userId, "post", postId)
            .then(() => postRepo.addScore(postId, 1))
            .then((updated) => {
              res.status(200).json(updated);
            });
        });
      })
      .catch(next);
  });

  // comment への up vote（認証必須・二重投票防止・ADR-0020）
  router.post("/comments/:commentId/vote", requireAuth, (req, res, next) => {
    const { commentId } = req.params as { commentId: string };
    const userId = req.user!.id;

    commentRepo
      .findById(commentId)
      .then((comment) => {
        if (!comment) {
          throw new NotFoundError("CommentNotFound");
        }
        return voteRepo.hasVoted(userId, "comment", commentId).then((alreadyVoted) => {
          if (alreadyVoted) {
            throw new ConflictError("AlreadyVoted");
          }
          return voteRepo
            .create(userId, "comment", commentId)
            .then(() => commentRepo.addScore(commentId, 1))
            .then((updated) => {
              res.status(200).json(updated);
            });
        });
      })
      .catch(next);
  });

  return router;
}
