import express, { type Express } from "express";
import session from "express-session";

import { createPassport } from "./auth/passport.js";
import { errorHandler } from "./middleware/errorHandler.js";
import {
  InMemoryChannelMembershipRepository,
  type ChannelMembershipRepository,
} from "./persistence/channelMembershipRepository.js";
import type { MessageRepository } from "./persistence/messageRepository.js";
import { InMemoryUserRepository, type UserRepository } from "./persistence/userRepository.js";
import { createAuthRouter } from "./routes/auth.js";
import { createChannelsRouter } from "./routes/channels.js";
import { healthRouter } from "./routes/health.js";
import { createMessagesRouter } from "./routes/messages.js";

/** createApp の依存（永続化は注入する＝Express/Prisma からドメインを独立させる）。 */
export interface AppDeps {
  messageRepository: MessageRepository;
  /** 省略時はテスト用の空リポジトリを使用。本番では PrismaUserRepository を渡す。 */
  userRepository?: UserRepository;
  /** チャンネル所属（多対多）の永続化。省略時はインメモリ（#33）。 */
  channelMembershipRepository?: ChannelMembershipRepository;
}

/**
 * Express アプリを生成する（listen はしない＝supertest でテスト可能）。
 * 層分離: routes → usecases → persistence(IF)。ドメイン型は common。
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  const userRepository = deps.userRepository ?? new InMemoryUserRepository();
  const channelMembershipRepository =
    deps.channelMembershipRepository ?? new InMemoryChannelMembershipRepository();

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET 環境変数が設定されていません。本番環境では必須です。");
  }

  app.use(express.json());

  app.use(
    session({
      secret: sessionSecret ?? "hatchery-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      },
    }),
  );

  const passportInstance = createPassport(userRepository);
  app.use(passportInstance.initialize());
  app.use(passportInstance.session());

  app.use("/health", healthRouter);
  app.use("/auth", createAuthRouter(passportInstance));
  app.use("/messages", createMessagesRouter(deps.messageRepository));
  app.use("/channels", createChannelsRouter(channelMembershipRepository));
  app.use(errorHandler);
  return app;
}
