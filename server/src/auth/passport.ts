import type { AuthUser } from "@hatchery/common";
import bcrypt from "bcrypt";
import { Passport } from "passport";
import { Strategy as LocalStrategy } from "passport-local";

import type { User, UserRepository } from "../persistence/userRepository.js";

/** 認証ユーザー（DB の User）をセッションに載せる公開情報（AuthUser）へ写す（#51, #136, #185, #331）。 */
export function toAuthUser(user: User): AuthUser {
  const authUser: AuthUser = {
    id: user.id,
    loginId: user.loginId,
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

/** userRepo に束縛された独立した Passport インスタンスを生成する（グローバル汚染回避）。 */
export function createPassport(userRepo: UserRepository): PassportInstance {
  const p = new Passport();

  p.use(
    new LocalStrategy({ usernameField: "loginId" }, async (loginId, password, done) => {
      try {
        const user = await userRepo.findByLoginId(loginId);
        if (!user) return done(null, false);
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return done(null, false);
        return done(null, toAuthUser(user));
      } catch (err) {
        return done(err);
      }
    }),
  );

  p.serializeUser((user, done) => {
    done(null, user.id);
  });

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
