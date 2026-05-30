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
  InMemorySceneRepository,
  type SceneRecord,
  type SceneRepository,
} from "./persistence/sceneRepository.js";
export { PrismaSceneRepository } from "./persistence/prismaSceneRepository.js";
export { listScenes } from "./usecases/listScenes.js";
export { createScene } from "./usecases/createScene.js";
export {
  runSceneBatch,
  stubSceneGenerator,
  type RunSceneBatchDeps,
  type SceneGenerator,
} from "./batch/runSceneBatch.js";
