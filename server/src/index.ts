/**
 * @hatchery/server パッケージエントリ。
 * Express アプリ生成・定時バッチ・永続化境界の公開 API を re-export する（ADR-0004）。
 * 許可方向 server → common を守り、client には依存しない。
 */
export { createApp, type AppDeps } from "./app.js";
export { loadEnv, type ServerEnv } from "./config/env.js";
export { validateBody } from "./middleware/validateBody.js";
export { errorHandler } from "./middleware/errorHandler.js";
export {
  InMemoryMessageRepository,
  type MessageRecord,
  type MessageRepository,
} from "./persistence/messageRepository.js";
export { PrismaMessageRepository } from "./persistence/prismaMessageRepository.js";
export {
  InMemoryUserRepository,
  type UserRepository,
  type User,
} from "./persistence/userRepository.js";
export { PrismaUserRepository } from "./persistence/prismaUserRepository.js";
export { requireAuth } from "./middleware/requireAuth.js";
export { listMessages } from "./usecases/listMessages.js";
export { createMessages } from "./usecases/createMessages.js";
export {
  runMessageBatch,
  stubMessageGenerator,
  type RunMessageBatchDeps,
  type MessageGenerator,
} from "./batch/runMessageBatch.js";
