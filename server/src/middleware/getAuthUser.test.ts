import { UnauthorizedError } from "@hatchery/common";
import type { AuthUser } from "@hatchery/common";
import type { Request } from "express";
import { describe, expect, it } from "vitest";

import { getAuthUser } from "./getAuthUser.js";

const authUser: AuthUser = {
  id: "user1",
  email: "user1@example.com",
  displayName: "User One",
  role: "member",
};

describe("getAuthUser (#536)", () => {
  it("req.user があるとき AuthUser をそのまま返す", () => {
    const req = { user: authUser } as Pick<Request, "user">;
    expect(getAuthUser(req)).toEqual(authUser);
  });

  it("req.user が undefined のとき UnauthorizedError を投げる", () => {
    const req = { user: undefined } as Pick<Request, "user">;
    expect(() => getAuthUser(req)).toThrow(UnauthorizedError);
  });

  it("投げる UnauthorizedError は statusCode 401 を持つ", () => {
    const req = { user: undefined } as Pick<Request, "user">;
    try {
      getAuthUser(req);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect((err as UnauthorizedError).statusCode).toBe(401);
    }
  });
});
