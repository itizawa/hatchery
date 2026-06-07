import { type AcceptInvitation, AcceptInvitationSchema, getInvitationStatus } from "@hatchery/common";
import bcrypt from "bcrypt";
import { Router } from "express";

import { toAuthUser } from "../auth/passport.js";
import { validateBody } from "../middleware/validateBody.js";
import type { InvitationLinkRepository } from "../persistence/invitationLinkRepository.js";
import { LoginIdAlreadyExistsError, type UserRepository } from "../persistence/userRepository.js";

const BCRYPT_SALT_ROUNDS = 10;

export function createInvitationsRouter(
  invitationLinkRepository: InvitationLinkRepository,
  userRepository: UserRepository,
): Router {
  const router = Router();

  /** GET /invitations/:token — トークン検証（公開）。 */
  router.get("/:token", async (req, res, next) => {
    try {
      const record = await invitationLinkRepository.findByToken(req.params.token);
      if (!record) {
        res.status(404).json({ error: "Invitation not found" });
        return;
      }
      const status = getInvitationStatus(
        { revokedAt: record.revokedAt, usedAt: record.usedAt, expiresAt: record.expiresAt },
        new Date(),
      );
      res.json({ status, expiresAt: record.expiresAt });
    } catch (err) {
      next(err);
    }
  });

  /** POST /invitations/:token/accept — 受諾・User 作成・自動ログイン（公開）。 */
  router.post(
    "/:token/accept",
    validateBody(AcceptInvitationSchema),
    async (req, res, next) => {
      try {
        const { loginId, displayName, password } = req.body as AcceptInvitation;

        const record = await invitationLinkRepository.findByToken(req.params.token as string);
        if (!record) {
          res.status(404).json({ error: "Invitation not found" });
          return;
        }

        const status = getInvitationStatus(
          { revokedAt: record.revokedAt, usedAt: record.usedAt, expiresAt: record.expiresAt },
          new Date(),
        );
        if (status !== "active") {
          res.status(409).json({ error: `Invitation is ${status}` });
          return;
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        let newUser;
        try {
          newUser = await userRepository.create({ loginId, displayName, passwordHash });
        } catch (err) {
          if (err instanceof LoginIdAlreadyExistsError) {
            res.status(409).json({ error: "Login id already exists" });
            return;
          }
          throw err;
        }

        const marked = await invitationLinkRepository.markUsed(record.id, newUser.id);
        if (!marked) {
          res.status(409).json({ error: "Invitation is no longer active" });
          return;
        }

        const authUser = toAuthUser(newUser);
        req.login(authUser, (err) => {
          if (err) return next(err);
          res.status(201).json(authUser);
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
