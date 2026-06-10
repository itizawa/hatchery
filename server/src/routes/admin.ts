import {
  ConflictError,
  CreateCommunitySchema,
  CreateWorkerSchema,
  CreateInvitationSchema,
  NotFoundError,
  UpdateAppSettingSchema,
  UpdateCommunitySchema,
} from "@hatchery/common";
import { randomBytes, randomUUID } from "crypto";
import { Router } from "express";

import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import type { CommunityRecord, CommunityRepository } from "../persistence/communityRepository.js";
import type { WorkerRepository } from "../persistence/workerRepository.js";
import {
  toInvitationLinkResponse,
  type InvitationLinkRepository,
} from "../persistence/invitationLinkRepository.js";
import { decrypt, encrypt, maskApiKey } from "../utils/crypto.js";
import { getApiKey } from "../utils/apiKey.js";

const MASKED_KEYS = new Set(["CLAUDE_API_KEY"]);

/** CommunityRecord（camelCase）をクライアント向け Community（snake_case）に変換する（#310）。 */
function toCommunityResponse(r: CommunityRecord) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    synopsis: r.synopsis ?? undefined,
    last_slot_key: r.lastSlotKey ?? undefined,
    created_at: r.createdAt,
  };
}

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
  workerRepository: WorkerRepository,
  communityRepository: CommunityRepository,
): Router {
  const router = Router();

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

  router.delete("/workers/:id", async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const result = await workerRepository.softDelete(id);
      if (!result) {
        next(new NotFoundError("WorkerNotFound"));
        return;
      }
      res.status(200).json({ id: result.id, deletedAt: result.deletedAt });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/workers",
    validateBody(CreateWorkerSchema),
    async (req, res, next) => {
      try {
        const input = req.body as { displayName: string; role?: string; personality?: string };
        const worker = await workerRepository.create({
          id: randomUUID(),
          displayName: input.displayName,
          role: input.role,
          personality: input.personality,
        });
        res.status(201).json(worker);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get("/communities", async (_req, res, next) => {
    try {
      const communities = await communityRepository.list();
      res.json(communities.map(toCommunityResponse));
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/communities",
    validateBody(CreateCommunitySchema),
    async (req, res, next) => {
      try {
        const { slug, name, description } = req.body as {
          slug: string;
          name: string;
          description: string;
        };
        const existing = await communityRepository.findBySlug(slug);
        if (existing) {
          next(new ConflictError("CommunitySlugAlreadyExists"));
          return;
        }
        const community = await communityRepository.create({ slug, name, description });
        res.status(201).json(toCommunityResponse(community));
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    "/communities/:id",
    validateBody(UpdateCommunitySchema),
    async (req, res, next) => {
      try {
        const { id } = req.params as { id: string };
        const input = req.body as { name?: string; description?: string };
        const community = await communityRepository.update(id, input);
        if (!community) {
          next(new NotFoundError("CommunityNotFound"));
          return;
        }
        res.json(toCommunityResponse(community));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export { getApiKey };
