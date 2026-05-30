import { Router } from "express";

/** ヘルスチェック。GET /health → 200 { status: "ok" }。 */
export const healthRouter: Router = Router();

healthRouter.get("/", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
