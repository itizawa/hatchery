import { UnauthorizedError } from "@hatchery/common";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { requireAuth } from "./requireAuth.js";

function makeReq(authenticated: boolean): Partial<Request> {
  return {
    isAuthenticated: () => authenticated,
  } as Partial<Request>;
}

const res = {} as Response;

describe("requireAuth (#374)", () => {
  it("認証済みのとき next() が引数なしで呼ばれる", () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq(true);
    requireAuth(req as Request, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it("未認証のとき next が UnauthorizedError を引数に呼ばれる", () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq(false);
    requireAuth(req as Request, res, next);
    expect(next).toHaveBeenCalledOnce();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as unknown;
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect((err as UnauthorizedError).statusCode).toBe(401);
    expect((err as UnauthorizedError).message).toBe("Unauthorized");
  });
});
