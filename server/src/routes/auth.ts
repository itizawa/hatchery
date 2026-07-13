import { UpdateProfileSchema } from "@hatchery/common";
import type { RequestHandler } from "express";
import { Router } from "express";

import type { GoogleAuthConfig, PassportInstance } from "../auth/passport.js";
import { toAuthUser } from "../auth/passport.js";
import { DEFAULT_PUBLIC_BASE_URL } from "../config/env.js";
import { getAuthUser } from "../middleware/getAuthUser.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validateBody.js";
import type { UserRepository } from "../persistence/userRepository.js";

// #455: Google-only auth。dev-login は NODE_ENV !== 'production' のときのみ登録。
export function createAuthRouter({
  passportInstance,
  userRepository,
  googleConfig,
  nodeEnv = process.env.NODE_ENV ?? "development",
  // #78: OAuth 後の戻り先フロント絶対 URL。API（Cloud Run）とフロント（Pages）が別オリジンのため、
  // 相対パスへリダイレクトすると API 側に戻ってしまい 404 になる。フロントのオリジンを前置する。
  frontendBaseUrl = DEFAULT_PUBLIC_BASE_URL,
}: {
  passportInstance: PassportInstance;
  userRepository: UserRepository;
  googleConfig?: GoogleAuthConfig;
  nodeEnv?: string;
  frontendBaseUrl?: string;
}): Router {
  const router = Router();
  const frontendOrigin = frontendBaseUrl.replace(/\/$/, "");

  // eslint-disable-next-line max-params
  router.post("/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ ok: true });
    });
  });

  // eslint-disable-next-line max-params
  router.get("/me", requireAuth, (req, res) => {
    res.status(200).json(req.user);
  });

  // eslint-disable-next-line max-params
  router.patch("/me", requireAuth, validateBody(UpdateProfileSchema), async (req, res, next) => {
    try {
      const userId = getAuthUser(req).id;
      const updated = await userRepository.updateProfile(userId, req.body);
      res.status(200).json(toAuthUser(updated));
    } catch (err) {
      next(err);
    }
  });

  if (googleConfig) {
    router.get(
      "/google",
      passportInstance.authenticate("google", { scope: ["profile", "email"] }) as RequestHandler,
    );

    router.get(
      "/google/callback",
      passportInstance.authenticate("google", {
        failureRedirect: `${frontendOrigin}/login`,
      }) as RequestHandler,
      // eslint-disable-next-line max-params
      (req, res) => {
        // 初回ログイン（新規ユーザー作成時）はアカウント設定画面へ誘導し、表示名の設定を促す。
        // passport の verify callback が done の info で渡した isNewUser を req.authInfo で受け取る。
        const isNewUser = (req.authInfo as { isNewUser?: boolean } | undefined)?.isNewUser === true;
        res.redirect(`${frontendOrigin}${isNewUser ? "/account?welcome=1" : "/"}`);
      },
    );
  }

  // 開発専用バイパスログイン。本番環境では登録しない（#455）。
  if (nodeEnv !== "production") {
    // eslint-disable-next-line max-params
    router.post("/dev-login", async (req, res, next) => {
      try {
        const devUser = await userRepository.findByGoogleId("dev-google-id");
        if (!devUser) {
          res.status(404).json({ error: "Dev user not found. Run db:seed first." });
          return;
        }
        const authUser = toAuthUser(devUser);
        req.login(authUser, (err) => {
          if (err) return next(err);
          res.status(200).json(authUser);
        });
      } catch (err) {
        next(err);
      }
    });
  }

  return router;
}
