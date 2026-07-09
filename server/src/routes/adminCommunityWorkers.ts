import { BadRequestError, NotFoundError, SetCommunityWorkersSchema } from "@hatchery/common";
import { Router } from "express";

import { requireAdminAccess } from "../middleware/requireAdminAccess.js";
import { validateBody } from "../middleware/validateBody.js";
import type { CommunityRepository } from "../persistence/communityRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import type { WorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";

/**
 * admin 向けコミュニティ所属ワーカー編集ルーター（#1079）。
 * - GET  /api/admin/communities/:id/workers … 所属ワーカー一覧（id・displayName）を返す
 * - PUT  /api/admin/communities/:id/workers … 所属ワーカーを置き換える（set）
 *
 * `adminWorkerCommunities.ts`（#490・ワーカー起点）の逆方向。admin 権限必須。
 * リクエスト検証は common の Zod スキーマで行う（ADR-0006）。
 */
// eslint-disable-next-line max-params
export function createAdminCommunityWorkersRouter(
  communityRepository: CommunityRepository,
  workerCommunityRepository: WorkerCommunityRepository,
  workerRepository: WorkerRepository,
): Router {
  const router = Router();

  router.use(requireAdminAccess);

  // eslint-disable-next-line max-params
  router.get("/communities/:id/workers", async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const community = await communityRepository.findById(id);
      if (!community) {
        next(new NotFoundError("CommunityNotFound"));
        return;
      }
      const workers = await workerCommunityRepository.listWorkerSummariesByCommunity(id);
      res.status(200).json({ workers });
    } catch (err) {
      next(err);
    }
  });

  router.put(
    "/communities/:id/workers",
    validateBody(SetCommunityWorkersSchema),
    // eslint-disable-next-line max-params
    async (req, res, next) => {
      try {
        const { id } = req.params as { id: string };
        const { workerIds } = req.body as { workerIds: string[] };

        const community = await communityRepository.findById(id);
        if (!community) {
          next(new NotFoundError("CommunityNotFound"));
          return;
        }

        // 存在しない workerId を含む場合は 400。重複を除いて一括存在チェックする。
        const uniqueIds = [...new Set(workerIds)];
        const found = await Promise.all(
          uniqueIds.map((workerId) => workerRepository.findById(workerId)),
        );
        // eslint-disable-next-line max-params
        const missing = uniqueIds.filter((_, i) => found[i] == null);
        if (missing.length > 0) {
          next(new BadRequestError(`InvalidWorkerId: ${missing.join(", ")}`));
          return;
        }

        await workerCommunityRepository.setCommunityWorkers(id, uniqueIds);
        const result = await workerCommunityRepository.listWorkerSummariesByCommunity(id);
        res.status(200).json({ workers: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
