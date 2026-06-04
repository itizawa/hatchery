import { LoginRequestSchema, UpdateProfileSchema } from "@hatchery/common";
import type { RequestHandler } from "express";
import { Router } from "express";

import type { PassportInstance } from "../auth/passport.js";
import { toAuthUser } from "../auth/passport.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { UserRepository } from "../persistence/userRepository.js";

export function createAuthRouter(
  passportInstance: PassportInstance,
  userRepository: UserRepository,
): Router {
  const router = Router();

  router.post(
    "/login",
    validateBody(LoginRequestSchema),
    (passportInstance.authenticate("local") as RequestHandler),
    (req, res) => {
      res.status(200).json(req.user);
    },
  );

  router.post("/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ ok: true });
    });
  });

  router.get("/me", requireAuth, (req, res) => {
    res.status(200).json(req.user);
  });

  router.patch("/me", requireAuth, validateBody(UpdateProfileSchema), async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const updated = await userRepository.updateProfile(userId, req.body);
      res.status(200).json(toAuthUser(updated));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
