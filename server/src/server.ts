import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { prisma } from "./persistence/prismaClient.js";
import { PrismaMessageRepository } from "./persistence/prismaMessageRepository.js";
import { PrismaUserRepository } from "./persistence/prismaUserRepository.js";

/** API プロセスの起動エントリ。createApp に Prisma 実装を注入して listen する。 */
const env = loadEnv();
const app = createApp({
  messageRepository: new PrismaMessageRepository(prisma),
  userRepository: new PrismaUserRepository(prisma),
});

app.listen(env.port, () => {
  console.log(`[server] listening on :${env.port}`);
});
