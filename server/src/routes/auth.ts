import { LoginRequestSchema } from "@hatchery/common";
import type { RequestHandler } from "express";
import { Router } from "express";
import type { Passport } from "passport";

import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";

export function createAuthRouter(passportInstance: Passport): Router {
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

  return router;
}
