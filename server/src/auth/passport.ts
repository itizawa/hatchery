import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

import type { UserRepository } from "../persistence/userRepository.js";

export function configurePassport(userRepo: UserRepository): void {
  passport.use(
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

  passport.serializeUser((user, done) => {
    done(null, (user as { id: string }).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await userRepo.findById(id);
      if (!user) return done(null, false);
      done(null, { id: user.id, displayName: user.displayName });
    } catch (err) {
      done(err);
    }
  });
}
