import {
  UpdateWorkerSchema,
  WorkerListQuerySchema,
  err,
  isErr,
  notFound,
  ok,
  type UpdateWorkerInput,
} from "@hatchery/common";
import { Router } from "express";

import { requireAdminAccess } from "../middleware/requireAdminAccess.js";
import { validateBody } from "../middleware/validateBody.js";
import type { ViewRepository } from "../persistence/viewRepository.js";
import type { VoteRepository } from "../persistence/voteRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import { resultToResponse } from "../utils/resultToResponse.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;
const RANKING_LIMIT = 1000;
/** ランキング集計ウィンドウ（直近 7 日）。 */
const RANKING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function createWorkersRouter(
  workerRepository: WorkerRepository,
  viewRepository: ViewRepository,
  voteRepository: VoteRepository,
): Router {
  const router = Router();

  // ワーカーランキング（認証不要・#665 / ADR-0032）。/ranking は /:id より先に定義する。
  router.get("/ranking", (_req, res, next) => {
    const since = new Date(Date.now() - RANKING_WINDOW_MS);
    Promise.all([
      workerRepository.listBotWorkersPaginated(1, RANKING_LIMIT, false),
      viewRepository.viewsByWorkerSince(since),
      voteRepository.netScoresByWorkerSince(since),
    ])
      .then(([{ workers }, viewCounts, voteScores]) => {
        const ranking = workers.map((w) => ({
          worker_id: w.id,
          display_name: w.displayName,
          view_count: viewCounts.get(w.id) ?? 0,
          vote_net_score: voteScores.get(w.id) ?? 0,
        }));
        res.status(200).json({ workers: ranking });
      })
      .catch(next);
  });

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

  router.patch(
    "/:id",
    requireAdminAccess,
    validateBody(UpdateWorkerSchema),
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
