import { UpdateAppSettingSchema } from "@hatchery/common";
import { Router } from "express";

import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import { decrypt, encrypt, maskApiKey } from "../utils/crypto.js";
import { getApiKey } from "../utils/apiKey.js";

const MASKED_KEYS = new Set(["CLAUDE_API_KEY"]);

function toResponse(key: string, encryptedValue: string) {
  let rawValue = "";
  if (encryptedValue) {
    try {
      rawValue = decrypt(encryptedValue);
    } catch {
      // 復号に失敗した場合（不正な形式・古いデータ等）はマスク表示で隠す
      return { key, maskedValue: "****" };
    }
  }
  const maskedValue = MASKED_KEYS.has(key) ? maskApiKey(rawValue) : rawValue || null;
  return { key, maskedValue };
}

export function createAdminRouter(appSettingRepository: AppSettingRepository): Router {
  const router = Router();

  // #136: /admin/* は requireAuth → requireAdmin で一括保護する（admin ロール必須）。
  router.use(requireAuth, requireAdmin);

  router.get("/settings", async (_req, res, next) => {
    try {
      const settings = await appSettingRepository.findAll();
      res.json(settings.map((s) => toResponse(s.key, s.value)));
    } catch (err) {
      next(err);
    }
  });

  router.patch(
    "/settings",
    validateBody(UpdateAppSettingSchema),
    async (req, res, next) => {
      try {
        const { key, value } = req.body as { key: string; value: string };
        const encrypted = value ? encrypt(value) : "";
        const setting = await appSettingRepository.upsert(key, encrypted);
        res.json(toResponse(setting.key, setting.value));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export { getApiKey };
