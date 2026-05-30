import express, { type Express } from "express";
import session from "express-session";
import passport from "passport";

import { configurePassport } from "./auth/passport.js";
import { errorHandler } from "./middleware/errorHandler.js";
import type { SceneRepository } from "./persistence/sceneRepository.js";
import { InMemoryUserRepository, type UserRepository } from "./persistence/userRepository.js";
import { createAuthRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { createScenesRouter } from "./routes/scenes.js";

/** createApp の依存（永続化は注入する＝Express/Prisma からドメインを独立させる）。 */
export interface AppDeps {
  sceneRepository: SceneRepository;
  /** 省略時はテスト用の空リポジトリを使用。本番では PrismaUserRepository を渡す。 */
  userRepository?: UserRepository;
}

/**
 * Express アプリを生成する（listen はしない＝supertest でテスト可能）。
 * 層分離: routes → usecases → persistence(IF)。ドメイン型は common。
 */
export function createApp(deps: AppDeps): Express {
  const app = express();
  const userRepository = deps.userRepository ?? new InMemoryUserRepository();
  app.use(express.json());

  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? "hatchery-dev-secret",
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

  configurePassport(userRepository);
  app.use(passport.initialize());
  app.use(passport.session());

  app.use("/health", healthRouter);
  app.use("/auth", createAuthRouter());
  app.use("/scenes", createScenesRouter(deps.sceneRepository));
  app.use(errorHandler);
  return app;
}
