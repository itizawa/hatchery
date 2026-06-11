import type { AuthUser } from "@hatchery/common";
import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import { beforeAll, describe, expect, it } from "vitest";

import type { User, UserRepository } from "../persistence/userRepository.js";
import { createInMemoryUserRepository } from "../persistence/userRepository.js";
import type { PassportInstance } from "./passport.js";
import { createPassport, toAuthUser } from "./passport.js";

/** テスト高速化のため bcrypt のコストは最小限にする（実ハッシュでの照合は維持）。 */
const BCRYPT_ROUNDS = 4;

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await bcrypt.hash("correct-password", BCRYPT_ROUNDS);
});

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    loginId: "alice",
    displayName: "Alice",
    passwordHash,
    role: "member",
    avatarUrl: null,
    ...overrides,
  };
}

type AuthResult = { err: unknown; user: AuthUser | false | undefined };

/**
 * 公開 API の authenticate ミドルウェアを最小限のリクエストスタブで実行し、
 * local Strategy の verify 結果（err / user）をカスタムコールバックで受け取る。
 */
function runLocalAuth(p: PassportInstance, body: Record<string, string>): Promise<AuthResult> {
  return new Promise((resolve, reject) => {
    const middleware = p.authenticate("local", (err: unknown, user?: AuthUser | false) => {
      resolve({ err, user });
    });
    const req = { body, query: {} } as unknown as Request;
    const res = {} as Response;
    middleware(req, res, (err?: unknown) => {
      if (err) reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/** @types/passport は登録形しか公開しないため、実行形のシグネチャへ写すヘルパ。 */
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

describe("createPassport: local Strategy verify", () => {
  it("正しい loginId / password で AuthUser が返る（認証成功）", async () => {
    const p = createPassport(createInMemoryUserRepository([buildUser()]));
    const { err, user } = await runLocalAuth(p, {
      loginId: "alice",
      password: "correct-password",
    });
    expect(err).toBeNull();
    expect(user).toEqual({
      id: "user-1",
      loginId: "alice",
      displayName: "Alice",
      role: "member",
    });
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("存在しない loginId で失敗（user=false・エラーなし）になる", async () => {
    const p = createPassport(createInMemoryUserRepository([buildUser()]));
    const { err, user } = await runLocalAuth(p, {
      loginId: "nobody",
      password: "correct-password",
    });
    expect(err).toBeNull();
    expect(user).toBe(false);
  });

  it("パスワード不一致で失敗（user=false・エラーなし）になる", async () => {
    const p = createPassport(createInMemoryUserRepository([buildUser()]));
    const { err, user } = await runLocalAuth(p, {
      loginId: "alice",
      password: "wrong-password",
    });
    expect(err).toBeNull();
    expect(user).toBe(false);
  });

  it("リポジトリが throw したらエラーとして伝播する", async () => {
    const boom = new Error("db down");
    const repo: UserRepository = {
      ...createInMemoryUserRepository(),
      findByLoginId: () => Promise.reject(boom),
    };
    const p = createPassport(repo);
    const { err, user } = await runLocalAuth(p, {
      loginId: "alice",
      password: "correct-password",
    });
    expect(err).toBe(boom);
    expect(user).toBeUndefined();
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
    expect(user).toEqual({
      id: "user-1",
      loginId: "alice",
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

describe("toAuthUser", () => {
  it("passwordHash を含まない公開情報へ写す（avatarUrl なし）", () => {
    const authUser = toAuthUser(buildUser());
    expect(authUser).toEqual({
      id: "user-1",
      loginId: "alice",
      displayName: "Alice",
      role: "member",
    });
    expect(authUser).not.toHaveProperty("avatarUrl");
  });

  it("avatarUrl が設定されていれば引き継ぐ", () => {
    const authUser = toAuthUser(buildUser({ avatarUrl: "https://example.com/a.png" }));
    expect(authUser.avatarUrl).toBe("https://example.com/a.png");
  });
});
