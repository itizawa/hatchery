import { CommentViewsRequestSchema, NotFoundError, PostViewRequestSchema, VoteRequestSchema } from "@hatchery/common";
import { Router } from "express";

import { getAuthUser } from "../middleware/getAuthUser.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { CommentRepository } from "../persistence/commentRepository.js";
import type { PostRepository } from "../persistence/postRepository.js";
import type { ViewRepository } from "../persistence/viewRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import { buildAuthorWorkerEnricher } from "./authorWorker.js";
import { toCommentResponse, toPostResponse } from "./postResponse.js";

/**
 * /api/posts・/api/comments ルータ。
 * スレッド（post + comments）の取得、up/down vote、閲覧ビーコンを担う。ADR-0019 / ADR-0025 / ADR-0032。
 * - 読み取りは認証不要
 * - vote は認証必須（ADR-0025: up/down 両対応、toggle/switch）
 * - 閲覧ビーコン（/view・/comment-views）は認証不要（ゲスト対応・#665）
 * - #479: スレッドの post / 各 comment に発言者の表示用ワーカー情報（author_worker）を付与する。
 */
// eslint-disable-next-line max-params
export function createPostsRouter(
  postRepo: PostRepository,
  commentRepo: CommentRepository,
  voteRepo: VoteRepository,
  viewRepo: ViewRepository,
  workerRepo: WorkerRepository,
): Router {
  const router = Router();

  // スレッド取得（post + comments・認証不要）
  // eslint-disable-next-line max-params
  router.get("/posts/:postId", (req, res, next) => {
    const { postId } = req.params as { postId: string };
    postRepo
      .findById(postId)
      .then((post) => {
        if (!post) {
          throw new NotFoundError("PostNotFound");
        }
        // reveal フィルタ（#556）: createdAt <= now のコメントのみ公開する。
        const now = new Date();
        return commentRepo.listByPost(postId, { now }).then(async (comments) => {
          // post と comments を 1 回のワーカー取得で付与する（重複クエリを避ける）。
          const enrich = await buildAuthorWorkerEnricher(workerRepo);
          const [enrichedPost] = enrich([post]);
          // enrich([post]) は必ず 1 要素返る（post は上の null ガード済み）。
          const enrichedComments = enrich(comments);
          // reveal 済みコメント件数を付与する（#779: 詳細 API でも comment_count を正確に返す）。
          const postWithCount = { ...(enrichedPost ?? post), commentCount: comments.length };
          // OpenAPI 契約（snake_case）へ整形して返す（#499）。
          res.status(200).json({
            post: toPostResponse(postWithCount),
            comments: enrichedComments.map(toCommentResponse),
          });
        });
      })
      .catch(next);
  });

  // post 閲覧ビーコン（認証不要・ゲスト対応・#665 / ADR-0032）
  // eslint-disable-next-line max-params
  router.post("/posts/:postId/view", validateBody(PostViewRequestSchema), (req, res, next) => {
    const { postId } = req.params as { postId: string };
    const { sessionId } = req.body as { sessionId: string };
    const userId = (req.user as { id?: string } | undefined)?.id ?? null;

    postRepo
      .findById(postId)
      .then((post) => {
        if (!post) throw new NotFoundError("PostNotFound");
        return viewRepo.recordPostView(postId, sessionId, userId);
      })
      .then(() => {
        res.status(202).end();
      })
      .catch(next);
  });

  // コメント閲覧ビーコン（認証不要・バッチ送信・#665 / ADR-0032）
  router.post(
    "/posts/:postId/comment-views",
    validateBody(CommentViewsRequestSchema),
    // eslint-disable-next-line max-params
    (req, res, next) => {
      const { postId } = req.params as { postId: string };
      const { sessionId, commentIds } = req.body as { sessionId: string; commentIds: string[] };
      const userId = (req.user as { id?: string } | undefined)?.id ?? null;

      postRepo
        .findById(postId)
        .then((post) => {
          if (!post) throw new NotFoundError("PostNotFound");
          return viewRepo.recordCommentViews(commentIds, sessionId, userId);
        })
        .then(() => {
          res.status(202).end();
        })
        .catch(next);
    },
  );

  // post への vote（認証必須・toggle/switch・ADR-0025）
  router.post(
    "/posts/:postId/vote",
    requireAuth,
    validateBody(VoteRequestSchema),
    // eslint-disable-next-line max-params
    (req, res, next) => {
      const { postId } = req.params as { postId: string };
      const userId = getAuthUser(req).id;
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
            .then(({ score }) =>
              // comment_count を vote レスポンスにも付与する（#779）。
              commentRepo.countByPostIds([postId]).then((counts) => {
                const commentCount = counts.get(postId) ?? 0;
                res.status(200).json(toPostResponse({ ...post, score: score ?? post.score, commentCount }));
              }),
            );
        })
        .catch(next);
    },
  );

  // comment への vote（認証必須・toggle/switch・ADR-0025）
  router.post(
    "/comments/:commentId/vote",
    requireAuth,
    validateBody(VoteRequestSchema),
    // eslint-disable-next-line max-params
    (req, res, next) => {
      const { commentId } = req.params as { commentId: string };
      const userId = getAuthUser(req).id;
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
              // OpenAPI 契約（snake_case）へ整形して返す（#499）。
              res.status(200).json(toCommentResponse({ ...comment, score: score ?? comment.score }));
            });
        })
        .catch(next);
    },
  );

  return router;
}
