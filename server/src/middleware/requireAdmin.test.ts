import type { AuthUser } from "@hatchery/common";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { requireAdmin } from "./requireAdmin.js";

function makeReq(user?: AuthUser | null): Partial<Request> {
  return {
    isAuthenticated: () => user != null,
    user: user ?? undefined,
  } as Partial<Request>;
}

const res = {} as Response;

describe("requireAdmin (#136)", () => {
  it("admin ユーザーは next() が呼ばれる", () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq({ id: "u1", displayName: "Admin", role: "admin" });
    requireAdmin(req as Request, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it("member ユーザーは 403 ForbiddenError で next が呼ばれる", () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq({ id: "u2", displayName: "Member", role: "member" });
    requireAdmin(req as Request, res, next);
    expect(next).toHaveBeenCalledOnce();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeDefined();
    expect((err as { statusCode?: number }).statusCode).toBe(403);
  });

  it("未認証（user が undefined）は 401 UnauthorizedError で next が呼ばれる", () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq(null);
    requireAdmin(req as Request, res, next);
    expect(next).toHaveBeenCalledOnce();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeDefined();
    expect((err as { statusCode?: number }).statusCode).toBe(401);
  });
});
