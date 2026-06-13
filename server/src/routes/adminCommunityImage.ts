import { NotFoundError } from "@hatchery/common";
import multer from "multer";
import { Router } from "express";

import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { CommunityRepository } from "../persistence/communityRepository.js";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  type CommunityImageKind,
  type StorageService,
} from "../services/storageService.js";

/**
 * admin 管理者向けコミュニティ画像アップロードルーター（#457 / ADR-0022 流用）。
 * - POST /api/admin/communities/:id/icon … アイコン画像
 * - POST /api/admin/communities/:id/cover … カバー（ヘッダー）画像
 *
 * アイコン・カバーともに multer メモリ保存 → StorageService 経由で GCS 保存し、
 * 保存先 URL を Community.iconUrl / coverUrl に永続化して返す。
 * MIME 制限（png/jpeg/webp/gif）・サイズ上限（5MB）は worker 実装に合わせる。
 */
export function createAdminCommunityImageRouter(
  communityRepository: CommunityRepository,
  storageService: StorageService,
): Router {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter(_req, file, callback) {
      const allowedMimes: readonly string[] = ALLOWED_IMAGE_MIME_TYPES;
      if (allowedMimes.includes(file.mimetype)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  });

  function registerUpload(kind: CommunityImageKind) {
    router.post(
      `/communities/:id/${kind}`,
      requireAuth,
      requireAdmin,
      (req, res, next) => {
        upload.single("image")(req, res, (err) => {
          if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({ error: "FileTooLarge: image must be 5MB or less" });
            return;
          }
          if (err) {
            next(err);
            return;
          }
          next();
        });
      },
      async (req, res, next) => {
        try {
          const { id } = req.params as { id: string };

          if (!req.file) {
            res.status(400).json({
              error: `InvalidFile: image field is required. Allowed MIME types: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`,
            });
            return;
          }

          const community = await communityRepository.findById(id);
          if (!community) {
            throw new NotFoundError("CommunityNotFound");
          }

          const imageUrl = await storageService.uploadCommunityImage({
            communityId: id,
            kind,
            mimeType: req.file.mimetype,
            buffer: req.file.buffer,
          });

          const updated = await communityRepository.update(
            id,
            kind === "icon" ? { iconUrl: imageUrl } : { coverUrl: imageUrl },
          );
          if (!updated) {
            throw new NotFoundError("CommunityNotFound");
          }

          res.status(200).json(
            kind === "icon"
              ? { id: updated.id, iconUrl: updated.iconUrl }
              : { id: updated.id, coverUrl: updated.coverUrl },
          );
        } catch (err) {
          next(err);
        }
      },
    );
  }

  registerUpload("icon");
  registerUpload("cover");

  return router;
}
