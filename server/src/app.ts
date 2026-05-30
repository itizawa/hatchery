import express, { type Express } from "express";

import { errorHandler } from "./middleware/errorHandler.js";
import type { SceneRepository } from "./persistence/sceneRepository.js";
import { healthRouter } from "./routes/health.js";
import { createScenesRouter } from "./routes/scenes.js";

/** createApp の依存（永続化は注入する＝Express/Prisma からドメインを独立させる）。 */
export interface AppDeps {
  sceneRepository: SceneRepository;
}

/**
 * Express アプリを生成する（listen はしない＝supertest でテスト可能）。
 * 層分離: routes → usecases → persistence(IF)。ドメイン型は common。
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(express.json());
  app.use("/health", healthRouter);
  app.use("/scenes", createScenesRouter(deps.sceneRepository));
  app.use(errorHandler);
  return app;
}
