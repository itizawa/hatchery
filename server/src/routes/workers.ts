import {
  UpdateWorkerSchema,
  WorkerListQuerySchema,
  buildAuthorWorkerResolver,
  err,
  isErr,
  notFound,
  ok,
  type UpdateWorkerInput,
} from "@hatchery/common";
import { Router } from "express";

import { requireAdminAccess } from "../middleware/requireAdminAccess.js";
import { validateBody } from "../middleware/validateBody.js";
import type { PostRepository } from "../persistence/postRepository.js";
import type { ViewRepository } from "../persistence/viewRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import { toPostResponse } from "./postResponse.js";
import { resultToResponse } from "../utils/resultToResponse.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;
const RANKING_LIMIT = 1000;
/** ランキング集計ウィンドウ（直近 7 日）。 */
const RANKING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** ワーカー投稿一覧のデフォルト取得件数（#929）。 */
const WORKER_POSTS_DEFAULT_LIMIT = 20;

export function createWorkersRouter({
  workerRepository,
  viewRepository,
  voteRepository,
  postRepository,
}: {
  workerRepository: WorkerRepository;
  viewRepository: ViewRepository;
  voteRepository: VoteRepository;
  postRepository: PostRepository;
}): Router {
  const router = Router();

  // ワーカーランキング（認証不要・#665 / ADR-0032）。/ranking は /:workerId より先に定義する。
  // eslint-disable-next-line max-params
  router.get("/ranking", (_req, res, next) => {
    const since = new Date(Date.now() - RANKING_WINDOW_MS);
    Promise.all([
      workerRepository.listBotWorkersPaginated(1, RANKING_LIMIT, false),
      viewRepository.viewsByWorkerSince(since),
      voteRepository.netScoresByWorkerSince(since),
    ])
      .then(([{ workers }, viewCounts, voteScores]) => {
        const ranking = workers
          .map((w) => ({
            worker_id: w.id,
            display_name: w.displayName,
            view_count: viewCounts.get(w.id) ?? 0,
            vote_net_score: voteScores.get(w.id) ?? 0,
          }))
          // eslint-disable-next-line max-params
          .sort((a, b) => b.view_count - a.view_count || b.vote_net_score - a.vote_net_score);
        res.status(200).json({ workers: ranking });
      })
      .catch(next);
  });

  // eslint-disable-next-line max-params
  router.get("/", (req, res, next) => {
    const parsed = WorkerListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", issues: parsed.error.issues });
      return;
    }
    const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, includeDeleted = false } = parsed.data;
    workerRepository
      .listBotWorkersPaginated(page, limit, includeDeleted)
      .then(({ workers, total }) => res.status(200).json({ workers, total, page, limit }))
      .catch(next);
  });

  // ワーカー投稿一覧（認証不要・#929）。/:workerId より先に定義する（ルート優先順序:
  // 先に登録しないと Express が "posts" を :workerId パラメータとして解釈して詳細エンドポイントに吸われる）。
  // eslint-disable-next-line max-params
  router.get("/:workerId/posts", (req, res, next) => {
    const { workerId } = req.params as { workerId: string };
    const now = new Date();
    workerRepository
      .findById(workerId)
      .then((worker) => {
        if (!worker) {
          const result = err(notFound("WorkerNotFound"));
          resultToResponse(res, result);
          return;
        }
        return postRepository
          .listByAuthor({ authorId: workerId, limit: WORKER_POSTS_DEFAULT_LIMIT, now })
          .then((posts) => {
            // 既に findById で取得済みのワーカーを使って author_worker を付与する。
            // attachAuthorWorker(posts, workerRepository) は内部で listBotWorkers() を呼び
            // 全ワーカーをフルスキャンするため、そのコストを避ける。
            const resolve = buildAuthorWorkerResolver([worker]);
            const enriched = posts.map((post) => {
              const author_worker = resolve(post.author);
              return author_worker ? { ...post, author_worker } : { ...post };
            });
            res.status(200).json({ posts: enriched.map(toPostResponse) });
          });
      })
      .catch(next);
  });

  // eslint-disable-next-line max-params
  router.get("/:workerId", (req, res, next) => {
    const { workerId } = req.params as { workerId: string };
    workerRepository
      .findById(workerId)
      .then((worker) => {
        const result = worker ? ok(worker) : err(notFound("WorkerNotFound"));
        if (isErr(result)) { resultToResponse(res, result); return; }
        res.status(200).json(result.value);
      })
      .catch(next);
  });

  router.patch(
    "/:id",
    requireAdminAccess,
    validateBody(UpdateWorkerSchema),
    // eslint-disable-next-line max-params
    (req, res, next) => {
      const { id } = req.params as { id: string };
      const input = req.body as UpdateWorkerInput;
      workerRepository
        .update(id, input)
        .then((worker) => {
          const result = worker ? ok(worker) : err(notFound("WorkerNotFound"));
          if (isErr(result)) { resultToResponse(res, result); return; }
          res.status(200).json(result.value);
        })
        .catch(next);
    },
  );

  return router;
}
