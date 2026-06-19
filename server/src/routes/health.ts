import { Router } from "express";

/** ヘルスチェック。GET /health → 200 { status: "ok" }。 */
export const healthRouter: Router = Router();

// eslint-disable-next-line max-params
healthRouter.get("/", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
