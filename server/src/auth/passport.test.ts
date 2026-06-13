import type { AuthUser } from "@hatchery/common";
import { describe, expect, it } from "vitest";

import type { User } from "../persistence/userRepository.js";
import { createInMemoryUserRepository } from "../persistence/userRepository.js";
import type { PassportInstance } from "./passport.js";
import { createPassport, toAuthUser } from "./passport.js";

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "alice@example.com",
    googleId: "google-alice",
    displayName: "Alice",
    role: "member",
    avatarUrl: null,
    ...overrides,
  };
}

type SerializeRunner = {
  serializeUser(user: AuthUser, done: (err: unknown, id?: unknown) => void): void;
  deserializeUser(id: string, done: (err: unknown, user?: AuthUser | false) => void): void;
};

function runSerializeUser(p: PassportInstance, user: AuthUser): Promise<unknown> {
  return new Promise((resolve, reject) => {
    (p as unknown as SerializeRunner).serializeUser(user, (err, id) => {
      if (err) reject(err instanceof Error ? err : new Error(String(err)));
      else resolve(id);
    });
  });
}

function runDeserializeUser(p: PassportInstance, id: string): Promise<AuthUser | false | undefined> {
  return new Promise((resolve, reject) => {
    (p as unknown as SerializeRunner).deserializeUser(id, (err, user) => {
      if (err) reject(err instanceof Error ? err : new Error(String(err)));
      else resolve(user);
    });
  });
}

describe("toAuthUser (#455 Google-only auth)", () => {
  it("email を含み loginId を含まない公開情報へ写す", () => {
    const authUser = toAuthUser(buildUser());
    expect(authUser).toMatchObject({
      id: "user-1",
      email: "alice@example.com",
      displayName: "Alice",
      role: "member",
    });
    expect(authUser).not.toHaveProperty("loginId");
    expect(authUser).not.toHaveProperty("passwordHash");
  });

  it("avatarUrl が設定されていれば引き継ぐ", () => {
    const authUser = toAuthUser(buildUser({ avatarUrl: "https://example.com/a.png" }));
    expect(authUser.avatarUrl).toBe("https://example.com/a.png");
  });

  it("avatarUrl が null のとき avatarUrl フィールドを持たない", () => {
    const authUser = toAuthUser(buildUser({ avatarUrl: null }));
    expect(authUser).not.toHaveProperty("avatarUrl");
  });
});

describe("createPassport: LocalStrategy の不在 (#455)", () => {
  it("local strategy が登録されていない", () => {
    const p = createPassport(createInMemoryUserRepository([]));
    const strategies = (p as unknown as { _strategies: Record<string, unknown> })._strategies;
    expect(strategies).not.toHaveProperty("local");
  });
});

describe("createPassport: serializeUser / deserializeUser", () => {
  it("serializeUser はユーザーの id をセッション識別子にする", async () => {
    const p = createPassport(createInMemoryUserRepository([buildUser()]));
    const id = await runSerializeUser(p, toAuthUser(buildUser()));
    expect(id).toBe("user-1");
  });

  it("deserializeUser は id から AuthUser を解決する", async () => {
    const p = createPassport(createInMemoryUserRepository([buildUser()]));
    const user = await runDeserializeUser(p, "user-1");
    expect(user).toMatchObject({
      id: "user-1",
      email: "alice@example.com",
      displayName: "Alice",
      role: "member",
    });
  });

  it("存在しない id の deserializeUser は false を返す（エラーなし）", async () => {
    const p = createPassport(createInMemoryUserRepository([buildUser()]));
    const user = await runDeserializeUser(p, "unknown-id");
    expect(user).toBe(false);
  });
});
