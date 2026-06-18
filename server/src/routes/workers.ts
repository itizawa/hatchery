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
import type { WorkerRepository } from "../persistence/workerRepository.js";
import { resultToResponse } from "../utils/resultToResponse.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;

export function createWorkersRouter(workerRepository: WorkerRepository): Router {
  const router = Router();

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
