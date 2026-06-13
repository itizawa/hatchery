import { BadRequestError, NotFoundError, SetWorkerCommunitiesSchema } from "@hatchery/common";
import { Router } from "express";

import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { CommunityRepository } from "../persistence/communityRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import type { WorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";

/**
 * admin 向けワーカー参加コミュニティ編集ルーター（#490）。
 * - GET  /api/admin/workers/:id/communities … 参加コミュニティ id 一覧を返す
 * - PUT  /api/admin/workers/:id/communities … 参加コミュニティを置き換える（set）
 *
 * admin 権限必須（requireAuth + requireAdmin）。リクエスト検証は common の Zod スキーマで行う（ADR-0006）。
 */
export function createAdminWorkerCommunitiesRouter(
  workerRepository: WorkerRepository,
  workerCommunityRepository: WorkerCommunityRepository,
  communityRepository: CommunityRepository,
): Router {
  const router = Router();

  router.use(requireAuth, requireAdmin);

  router.get("/workers/:id/communities", async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const worker = await workerRepository.findById(id);
      if (!worker) {
        next(new NotFoundError("WorkerNotFound"));
        return;
      }
      const communityIds = await workerCommunityRepository.listCommunityIdsByWorker(id);
      res.status(200).json({ communityIds });
    } catch (err) {
      next(err);
    }
  });

  router.put(
    "/workers/:id/communities",
    validateBody(SetWorkerCommunitiesSchema),
    async (req, res, next) => {
      try {
        const { id } = req.params as { id: string };
        const { communityIds } = req.body as { communityIds: string[] };

        const worker = await workerRepository.findById(id);
        if (!worker) {
          next(new NotFoundError("WorkerNotFound"));
          return;
        }

        // 存在しない communityId を含む場合は 400。重複を除いて一括存在チェックする。
        const uniqueIds = [...new Set(communityIds)];
        const found = await Promise.all(
          uniqueIds.map((communityId) => communityRepository.findById(communityId)),
        );
        const missing = uniqueIds.filter((_, i) => found[i] == null);
        if (missing.length > 0) {
          next(new BadRequestError(`InvalidCommunityId: ${missing.join(", ")}`));
          return;
        }

        await workerCommunityRepository.setWorkerCommunities(id, uniqueIds);
        const result = await workerCommunityRepository.listCommunityIdsByWorker(id);
        res.status(200).json({ communityIds: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
