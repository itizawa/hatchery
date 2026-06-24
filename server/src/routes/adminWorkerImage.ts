import { NotFoundError } from "@hatchery/common";
import { Router } from "express";

import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  type StorageService,
} from "../services/storageService.js";
import { singleImageUpload } from "../middleware/imageUpload.js";

/**
 * admin 管理者向けワーカー画像アップロードルーター（#204 / ADR-0022）。
 * POST /api/admin/workers/:id/image
 */
// eslint-disable-next-line max-params
export function createAdminWorkerImageRouter(
  workerRepository: WorkerRepository,
  storageService: StorageService,
): Router {
  const router = Router();

  router.post(
    "/workers/:id/image",
    requireAuth,
    requireAdmin,
    singleImageUpload,
    // eslint-disable-next-line max-params
    async (req, res, next) => {
      try {
        const { id } = req.params as { id: string };

        if (!req.file) {
          res.status(400).json({
            error: `InvalidFile: image field is required. Allowed MIME types: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`,
          });
          return;
        }

        const worker = await workerRepository.findById(id);
        if (!worker) {
          throw new NotFoundError("WorkerNotFound");
        }

        const imageUrl = await storageService.uploadWorkerImage({
          workerId: id,
          mimeType: req.file.mimetype,
          buffer: req.file.buffer,
        });

        const updated = await workerRepository.updateImageUrl(id, imageUrl);
        if (!updated) {
          throw new NotFoundError("WorkerNotFound");
        }

        res.status(200).json({ id: updated.id, imageUrl: updated.imageUrl });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
