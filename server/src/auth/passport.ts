import type { AuthUser } from "@hatchery/common";
import { Passport } from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import { GoogleIdAlreadyExistsError, type User, type UserRepository } from "../persistence/userRepository.js";

/** 認証ユーザー（DB の User）をセッションに載せる公開情報（AuthUser）へ写す（#51, #136, #185, #331, #455）。 */
export function toAuthUser(user: User): AuthUser {
  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
  if (user.avatarUrl) authUser.avatarUrl = user.avatarUrl;
  return authUser;
}

/**
 * createPassport が返す passport インスタンスの型。
 * @types/passport では `Passport` は値（コンストラクタ）で型として使えないため、
 * その instance 型を導出して単一情報源とする。
 */
export type PassportInstance = InstanceType<typeof Passport>;

/** Google OAuth 設定（#343）。GOOGLE_CLIENT_ID 等の環境変数から組み立てる。 */
export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

/** userRepo に束縛された独立した Passport インスタンスを生成する（グローバル汚染回避）。 */
// eslint-disable-next-line max-params
export function createPassport(userRepo: UserRepository, googleConfig?: GoogleAuthConfig): PassportInstance {
  const p = new Passport();

  if (googleConfig) {
    p.use(
      new GoogleStrategy(
        {
          clientID: googleConfig.clientId,
          clientSecret: googleConfig.clientSecret,
          callbackURL: googleConfig.callbackUrl,
          // state: true で OAuth2 state パラメータを有効化し Login CSRF を防ぐ（#343）
          state: true,
        },
        // eslint-disable-next-line max-params
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const googleId = profile.id;
            const existing = await userRepo.findByGoogleId(googleId);
            if (existing) return done(null, toAuthUser(existing));

            const displayName = profile.displayName || `user_${googleId}`;
            const email = profile.emails?.[0]?.value ?? `${googleId}@google.local`;
            try {
              const newUser = await userRepo.create({ email, displayName, googleId });
              return done(null, toAuthUser(newUser));
            } catch (createErr) {
              if (createErr instanceof GoogleIdAlreadyExistsError) {
                // TOCTOU: 並行リクエストが先に同じ googleId でユーザーを作成した場合はリトライ（#455）。
                const retried = await userRepo.findByGoogleId(googleId);
                if (retried) return done(null, toAuthUser(retried));
                return done(null, false);
              }
              throw createErr;
            }
          } catch (err) {
            return done(err as Error);
          }
        },
      ),
    );
  }

  // eslint-disable-next-line max-params
  p.serializeUser((user, done) => {
    done(null, user.id);
  });

  // eslint-disable-next-line max-params
  p.deserializeUser(async (id: string, done) => {
    try {
      const user = await userRepo.findById(id);
      if (!user) return done(null, false);
      done(null, toAuthUser(user));
    } catch (err) {
      done(err);
    }
  });

  return p;
}
