import express, { type Express } from "express";

import { errorHandler } from "./middleware/errorHandler.js";
import type { MessageRepository } from "./persistence/messageRepository.js";
import { healthRouter } from "./routes/health.js";
import { createMessagesRouter } from "./routes/messages.js";

/** createApp の依存（永続化は注入する＝Express/Prisma からドメインを独立させる）。 */
export interface AppDeps {
  messageRepository: MessageRepository;
}

/**
 * Express アプリを生成する（listen はしない＝supertest でテスト可能）。
 * 層分離: routes → usecases → persistence(IF)。ドメイン型は common。
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(express.json());
  app.use("/health", healthRouter);
  app.use("/messages", createMessagesRouter(deps.messageRepository));
  app.use(errorHandler);
  return app;
}
