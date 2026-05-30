import bcrypt from "bcrypt";
import { Passport } from "passport";
import { Strategy as LocalStrategy } from "passport-local";

import type { UserRepository } from "../persistence/userRepository.js";

/** userRepo に束縛された独立した Passport インスタンスを生成する（グローバル汚染回避）。 */
export function createPassport(userRepo: UserRepository): Passport {
  const p = new Passport();

  p.use(
    new LocalStrategy({ usernameField: "id" }, async (id, password, done) => {
      try {
        const user = await userRepo.findById(id);
        if (!user) return done(null, false);
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return done(null, false);
        return done(null, { id: user.id, displayName: user.displayName });
      } catch (err) {
        return done(err);
      }
    }),
  );

  p.serializeUser((user, done) => {
    done(null, (user as { id: string }).id);
  });

  p.deserializeUser(async (id: string, done) => {
    try {
      const user = await userRepo.findById(id);
      if (!user) return done(null, false);
      done(null, { id: user.id, displayName: user.displayName });
    } catch (err) {
      done(err);
    }
  });

  return p;
}
