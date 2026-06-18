import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { requireAdminAccess } from "./requireAdminAccess.js";

function makeReq({
  user,
  authHeader,
}: {
  user?: { id: string; email?: string; displayName: string; role: string } | null;
  authHeader?: string;
}): Partial<Request> {
  return {
    isAuthenticated: () => user != null,
    user: user ?? undefined,
    headers: authHeader ? { authorization: authHeader } : {},
  } as Partial<Request>;
}

const res = {} as Response;

describe("requireAdminAccess (#603)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("Bearer トークン認証（HATCHERY_ADMIN_TOKEN 設定済み）", () => {
    it("正しい Bearer トークンを持つリクエストは next() が呼ばれる", () => {
      vi.stubEnv("HATCHERY_ADMIN_TOKEN", "secret-token");
      const next = vi.fn() as NextFunction;
      const req = makeReq({ authHeader: "Bearer secret-token" });
      requireAdminAccess(req as Request, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it("誤った Bearer トークンは session auth にフォールバックし、未認証なら 401 を返す", () => {
      vi.stubEnv("HATCHERY_ADMIN_TOKEN", "secret-token");
      const next = vi.fn() as NextFunction;
      const req = makeReq({ user: null, authHeader: "Bearer wrong-token" });
      requireAdminAccess(req as Request, res, next);
      expect(next).toHaveBeenCalledOnce();
      const callArg = (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect((callArg as { statusCode?: number }).statusCode).toBe(401);
    });

    it("Bearer トークンが空の場合は session auth にフォールバック", () => {
      vi.stubEnv("HATCHERY_ADMIN_TOKEN", "secret-token");
      const next = vi.fn() as NextFunction;
      const req = makeReq({
        user: { id: "u1", displayName: "Admin", role: "admin", email: "a@example.com" },
      });
      requireAdminAccess(req as Request, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("session 認証（HATCHERY_ADMIN_TOKEN 未設定）", () => {
    it("admin ユーザーは next() が呼ばれる", () => {
      const next = vi.fn() as NextFunction;
      const req = makeReq({
        user: { id: "u1", displayName: "Admin", role: "admin", email: "a@example.com" },
      });
      requireAdminAccess(req as Request, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it("member ユーザーは 403 ForbiddenError で next が呼ばれる", () => {
      const next = vi.fn() as NextFunction;
      const req = makeReq({
        user: { id: "u2", displayName: "Member", role: "member", email: "m@example.com" },
      });
      requireAdminAccess(req as Request, res, next);
      expect(next).toHaveBeenCalledOnce();
      const callArg = (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect((callArg as { statusCode?: number }).statusCode).toBe(403);
    });

    it("未認証（user が undefined）は 401 UnauthorizedError で next が呼ばれる", () => {
      const next = vi.fn() as NextFunction;
      const req = makeReq({ user: null });
      requireAdminAccess(req as Request, res, next);
      expect(next).toHaveBeenCalledOnce();
      const callArg = (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect((callArg as { statusCode?: number }).statusCode).toBe(401);
    });
  });
});
