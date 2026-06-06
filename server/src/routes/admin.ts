import { CreateInvitationSchema, UpdateAppSettingSchema } from "@hatchery/common";
import { randomBytes } from "crypto";
import { Router } from "express";

import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import {
  toInvitationLinkResponse,
  type InvitationLinkRepository,
} from "../persistence/invitationLinkRepository.js";
import { decrypt, encrypt, maskApiKey } from "../utils/crypto.js";
import { getApiKey } from "../utils/apiKey.js";

const MASKED_KEYS = new Set(["CLAUDE_API_KEY"]);

function toResponse(key: string, encryptedValue: string) {
  let rawValue = "";
  if (encryptedValue) {
    try {
      rawValue = decrypt(encryptedValue);
    } catch {
      return { key, maskedValue: "****" };
    }
  }
  const maskedValue = MASKED_KEYS.has(key) ? maskApiKey(rawValue) : rawValue || null;
  return { key, maskedValue };
}

export function createAdminRouter(
  appSettingRepository: AppSettingRepository,
  invitationLinkRepository: InvitationLinkRepository,
): Router {
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

  // 招待リンク API（#131）。
  router.post(
    "/invitations",
    validateBody(CreateInvitationSchema),
    async (req, res, next) => {
      try {
        const { expiresInHours, memo } = req.body as { expiresInHours: number; memo?: string };
        const token = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
        const userId = (req.user as { id: string }).id;

        const record = await invitationLinkRepository.create({
          token,
          expiresAt,
          createdByUserId: userId,
          memo,
        });

        res.status(201).json(toInvitationLinkResponse(record));
      } catch (err) {
        next(err);
      }
    },
  );

  router.get("/invitations", async (_req, res, next) => {
    try {
      const records = await invitationLinkRepository.list();
      const now = new Date();
      res.json(records.map((r) => toInvitationLinkResponse(r, now)));
    } catch (err) {
      next(err);
    }
  });

  router.post("/invitations/:id/revoke", async (req, res, next) => {
    try {
      const record = await invitationLinkRepository.revoke(req.params.id);
      if (!record) {
        res.status(404).json({ error: "Invitation not found" });
        return;
      }
      res.json(toInvitationLinkResponse(record));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export { getApiKey };
