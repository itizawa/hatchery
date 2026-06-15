import { UnauthorizedError } from "@hatchery/common";
import type { AuthUser } from "@hatchery/common";
import type { Request } from "express";

/**
 * 認証済みリクエストから {@link AuthUser} を型安全に取り出すヘルパー（#536）。
 *
 * `requireAuth` 通過後は `req.user` が必ず存在するが、Express の型上は
 * `User | undefined` のままで `req.user!` という非 null assertion が散在していた。
 * このヘルパーで型ガードを一元化し、未認証時は明示的に {@link UnauthorizedError}
 * を投げる。
 */
export function getAuthUser(req: Pick<Request, "user">): AuthUser {
  if (!req.user) {
    throw new UnauthorizedError();
  }
  return req.user;
}
