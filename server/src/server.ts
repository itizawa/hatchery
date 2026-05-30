import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { prisma } from "./persistence/prismaClient.js";
import { PrismaMessageRepository } from "./persistence/prismaMessageRepository.js";

/** API プロセスの起動エントリ。createApp に Prisma 実装を注入して listen する（ADR-0009）。 */
const env = loadEnv();
const app = createApp({ messageRepository: new PrismaMessageRepository(prisma) });

app.listen(env.port, () => {
  console.log(`[server] listening on :${env.port}`);
});
