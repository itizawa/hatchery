import bcrypt from "bcrypt";
import { describe, expect, it } from "vitest";
import {
  createInMemoryUserRepository,
  createTestUserRepository,
  LoginIdAlreadyExistsError,
  type User,
} from "./userRepository.js";

const baseUser: User = {
  id: "u1",
  loginId: "login1",
  displayName: "User One",
  passwordHash: "hash1",
  role: "member",
  avatarUrl: null,
};

describe("createInMemoryUserRepository", () => {
  it("findById は初期ユーザーを id で取得できる", async () => {
    const repo = createInMemoryUserRepository([{ ...baseUser }]);
    const user = await repo.findById("u1");
    expect(user).not.toBeNull();
    expect(user?.loginId).toBe("login1");
    expect(user?.displayName).toBe("User One");
    expect(user?.role).toBe("member");
  });

  it("findById は存在しない id に null を返す", async () => {
    const repo = createInMemoryUserRepository([{ ...baseUser }]);
    expect(await repo.findById("missing")).toBeNull();
  });

  it("findByLoginId は loginId で取得できる", async () => {
    const repo = createInMemoryUserRepository([{ ...baseUser }]);
    const user = await repo.findByLoginId("login1");
    expect(user?.id).toBe("u1");
  });

  it("findByLoginId は存在しない loginId に null を返す", async () => {
    const repo = createInMemoryUserRepository([{ ...baseUser }]);
    expect(await repo.findByLoginId("missing")).toBeNull();
  });

  it("create は id=loginId・role=member・avatarUrl=null でユーザーを作成し取得できる", async () => {
    const repo = createInMemoryUserRepository();
    const created = await repo.create({
      loginId: "newuser",
      displayName: "New User",
      passwordHash: "hash-new",
    });
    expect(created.id).toBe("newuser");
    expect(created.loginId).toBe("newuser");
    expect(created.displayName).toBe("New User");
    expect(created.passwordHash).toBe("hash-new");
    expect(created.role).toBe("member");
    expect(created.avatarUrl).toBeNull();

    const found = await repo.findByLoginId("newuser");
    expect(found).toEqual(created);
  });

  it("create は loginId 重複時に LoginIdAlreadyExistsError をスローする", () => {
    const repo = createInMemoryUserRepository([{ ...baseUser }]);
    // 現実装は同期的にスローする
    expect(() => repo.create({ loginId: "login1", displayName: "Dup", passwordHash: "h" })).toThrow(
      LoginIdAlreadyExistsError,
    );
  });

  it("updateProfile は displayName と avatarUrl を更新し findById に反映される", async () => {
    const repo = createInMemoryUserRepository([{ ...baseUser }]);
    const updated = await repo.updateProfile("u1", {
      displayName: "Renamed",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(updated.displayName).toBe("Renamed");
    expect(updated.avatarUrl).toBe("https://example.com/avatar.png");

    const found = await repo.findById("u1");
    expect(found?.displayName).toBe("Renamed");
    expect(found?.avatarUrl).toBe("https://example.com/avatar.png");
  });

  it("updateProfile は avatarUrl 省略時に既存値を維持する", async () => {
    const repo = createInMemoryUserRepository([
      { ...baseUser, avatarUrl: "https://example.com/old.png" },
    ]);
    const updated = await repo.updateProfile("u1", { displayName: "Renamed" });
    expect(updated.avatarUrl).toBe("https://example.com/old.png");
  });

  it("updateProfile は存在しない id にエラーをスローする", () => {
    const repo = createInMemoryUserRepository();
    // 現実装は同期的にスローする
    expect(() => repo.updateProfile("missing", { displayName: "X" })).toThrow(
      "User not found: missing",
    );
  });
});

describe("createTestUserRepository", () => {
  it("既定で role=admin の testuser を持ち、パスワードは testpass に一致する", async () => {
    const repo = await createTestUserRepository();
    const user = await repo.findByLoginId("testuser");
    expect(user).not.toBeNull();
    expect(user?.role).toBe("admin");
    expect(await bcrypt.compare("testpass", user?.passwordHash ?? "")).toBe(true);
  });

  it("role を指定するとそのロールが反映される", async () => {
    const repo = await createTestUserRepository("member");
    const user = await repo.findById("testuser");
    expect(user?.role).toBe("member");
  });
});
