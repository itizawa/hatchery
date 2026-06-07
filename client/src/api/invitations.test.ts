import { afterEach, describe, expect, it, vi } from "vitest";

import { acceptInvitation, createInvitation, fetchInvitation, fetchInvitations, revokeInvitation } from "./invitations.js";

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const sampleInvitation = {
  id: "inv-1",
  token: "tok-abc123",
  expiresAt: "2026-12-31T00:00:00Z",
  status: "active",
  memo: null,
  createdAt: "2026-01-01T00:00:00Z",
  usedAt: null,
};

describe("invitations API（openApiClient 経由）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("fetchInvitations", () => {
    it("openApiClient 経由で GET /api/admin/invitations を呼ぶ", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [sampleInvitation]));
      vi.stubGlobal("fetch", fetchMock);

      await fetchInvitations();

      const request = fetchMock.mock.calls[0][0] as Request;
      expect(request).toBeInstanceOf(Request);
      expect(request.url).toContain("/api/admin/invitations");
      expect(request.url).toMatch(/^https?:\/\//);
      expect(request.method).toBe("GET");
    });

    it("InvitationSchema で検証し expiresAt / createdAt を Date 化する", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, [sampleInvitation])));

      const invitations = await fetchInvitations();
      expect(invitations).toHaveLength(1);
      expect(invitations[0].id).toBe("inv-1");
      expect(invitations[0].expiresAt).toBeInstanceOf(Date);
      expect(invitations[0].createdAt).toBeInstanceOf(Date);
    });

    it("非 2xx で例外を投げる", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "Unauthorized" })));
      await expect(fetchInvitations()).rejects.toThrow();
    });
  });

  describe("createInvitation", () => {
    it("openApiClient 経由で POST /api/admin/invitations を呼ぶ", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, sampleInvitation));
      vi.stubGlobal("fetch", fetchMock);

      await createInvitation({ expiresInHours: 24 });

      const request = fetchMock.mock.calls[0][0] as Request;
      expect(request).toBeInstanceOf(Request);
      expect(request.url).toContain("/api/admin/invitations");
      expect(request.url).toMatch(/^https?:\/\//);
      expect(request.method).toBe("POST");
    });

    it("InvitationSchema で検証し Invitation を返す", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, sampleInvitation)));

      const invitation = await createInvitation({ expiresInHours: 24 });
      expect(invitation.id).toBe("inv-1");
      expect(invitation.token).toBe("tok-abc123");
      expect(invitation.status).toBe("active");
    });

    it("memo を渡すとリクエストボディに含まれる", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { ...sampleInvitation, memo: "テスト" }));
      vi.stubGlobal("fetch", fetchMock);

      await createInvitation({ expiresInHours: 24, memo: "テスト" });

      const request = fetchMock.mock.calls[0][0] as Request;
      const body = await request.json();
      expect(body).toMatchObject({ expiresInHours: 24, memo: "テスト" });
    });

    it("非 2xx で例外を投げる", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: "Bad Request" })));
      await expect(createInvitation({ expiresInHours: 24 })).rejects.toThrow();
    });
  });

  describe("revokeInvitation", () => {
    it("openApiClient 経由で POST /api/admin/invitations/{id}/revoke を呼ぶ", async () => {
      const revokedInv = { ...sampleInvitation, status: "revoked" };
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, revokedInv));
      vi.stubGlobal("fetch", fetchMock);

      await revokeInvitation("inv-1");

      const request = fetchMock.mock.calls[0][0] as Request;
      expect(request).toBeInstanceOf(Request);
      expect(request.url).toContain("/api/admin/invitations/inv-1/revoke");
      expect(request.url).toMatch(/^https?:\/\//);
      expect(request.method).toBe("POST");
    });

    it("失効後の Invitation を返す", async () => {
      const revokedInv = { ...sampleInvitation, status: "revoked" };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, revokedInv)));

      const invitation = await revokeInvitation("inv-1");
      expect(invitation.status).toBe("revoked");
    });

    it("非 2xx で例外を投げる", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: "Not found" })));
      await expect(revokeInvitation("non-existent")).rejects.toThrow();
    });
  });

  describe("fetchInvitation（公開トークン検証）", () => {
    it("openApiClient 経由で GET /api/invitations/{token} を呼ぶ", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(200, { status: "active", expiresAt: "2099-12-31T00:00:00Z" }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await fetchInvitation("tok-abc");

      const request = fetchMock.mock.calls[0][0] as Request;
      expect(request).toBeInstanceOf(Request);
      expect(request.url).toContain("/api/invitations/tok-abc");
      expect(request.method).toBe("GET");
    });

    it("200 で InvitationPublic（status / expiresAt）を返す", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(200, { status: "active", expiresAt: "2099-12-31T00:00:00Z" }),
        ),
      );

      const result = await fetchInvitation("tok-abc");
      expect(result).not.toBeNull();
      expect(result!.status).toBe("active");
      expect(result!.expiresAt).toBeInstanceOf(Date);
    });

    it("404 で null を返す（トークン不存在）", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: "Not found" })));

      const result = await fetchInvitation("nonexistent");
      expect(result).toBeNull();
    });

    it("404 以外の非 2xx で例外を投げる", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: "Server error" })));
      await expect(fetchInvitation("tok-abc")).rejects.toThrow();
    });
  });

  describe("acceptInvitation（受諾・User 作成）", () => {
    const acceptBody = { id: "newuser", displayName: "新ユーザー", password: "password123" };
    const sampleAuthUser = { id: "newuser", displayName: "新ユーザー", role: "member" };

    it("openApiClient 経由で POST /api/invitations/{token}/accept を呼ぶ", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, sampleAuthUser));
      vi.stubGlobal("fetch", fetchMock);

      await acceptInvitation("tok-abc", acceptBody);

      const request = fetchMock.mock.calls[0][0] as Request;
      expect(request).toBeInstanceOf(Request);
      expect(request.url).toContain("/api/invitations/tok-abc/accept");
      expect(request.method).toBe("POST");
    });

    it("201 で AuthUser を返す", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(201, sampleAuthUser)));

      const result = await acceptInvitation("tok-abc", acceptBody);
      expect(result.id).toBe("newuser");
      expect(result.displayName).toBe("新ユーザー");
    });

    it("リクエストボディに id / displayName / password が含まれる", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, sampleAuthUser));
      vi.stubGlobal("fetch", fetchMock);

      await acceptInvitation("tok-abc", acceptBody);

      const request = fetchMock.mock.calls[0][0] as Request;
      const body = await request.json();
      expect(body).toMatchObject({ id: "newuser", displayName: "新ユーザー", password: "password123" });
    });

    it("409 で ApiError(409) を投げる（ID 重複・招待失効）", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(409, { error: "User id already exists" })));
      await expect(acceptInvitation("tok-abc", acceptBody)).rejects.toMatchObject({ status: 409 });
    });

    it("404 で例外を投げる（トークン不存在）", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: "Not found" })));
      await expect(acceptInvitation("tok-abc", acceptBody)).rejects.toThrow();
    });
  });
});
