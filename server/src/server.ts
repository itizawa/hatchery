import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { prisma } from "./persistence/prismaClient.js";
import { PrismaSceneRepository } from "./persistence/prismaSceneRepository.js";

/** API プロセスの起動エントリ。createApp に Prisma 実装を注入して listen する。 */
const env = loadEnv();
const app = createApp({ sceneRepository: new PrismaSceneRepository(prisma) });

app.listen(env.port, () => {
  console.log(`[server] listening on :${env.port}`);
});
