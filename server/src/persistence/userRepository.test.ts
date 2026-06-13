import { describe, expect, it } from "vitest";
import {
  createInMemoryUserRepository,
  createTestUserRepository,
  GoogleIdAlreadyExistsError,
  type User,
} from "./userRepository.js";

const baseUser: User = {
  id: "u1",
  email: "user1@example.com",
  googleId: "google-u1",
  displayName: "User One",
  role: "member",
  avatarUrl: null,
};

describe("createInMemoryUserRepository (#455)", () => {
  it("findById は初期ユーザーを id で取得できる", async () => {
    const repo = createInMemoryUserRepository([{ ...baseUser }]);
    const user = await repo.findById("u1");
    expect(user).not.toBeNull();
    expect(user?.email).toBe("user1@example.com");
    expect(user?.googleId).toBe("google-u1");
    expect(user?.displayName).toBe("User One");
    expect(user?.role).toBe("member");
  });

  it("findById は存在しない id に null を返す", async () => {
    const repo = createInMemoryUserRepository([{ ...baseUser }]);
    expect(await repo.findById("missing")).toBeNull();
  });

  it("findByGoogleId は googleId で取得できる", async () => {
    const repo = createInMemoryUserRepository([{ ...baseUser }]);
    const user = await repo.findByGoogleId("google-u1");
    expect(user?.id).toBe("u1");
  });

  it("findByGoogleId は存在しない googleId に null を返す", async () => {
    const repo = createInMemoryUserRepository([{ ...baseUser }]);
    expect(await repo.findByGoogleId("missing")).toBeNull();
  });

  it("create は role=memberセavatarUrl=null でユーザーを作成し取得できる", async () => {
    const repo = createInMemoryUserRepository();
    const created = await repo.create({
      email: "new@example.com",
      googleId: "google-new",
      displayName: "New User",
    });
    expect(created.email).toBe("new@example.com");
    expect(created.googleId).toBe("google-new");
    expect(created.displayName).toBe("New User");
    expect(created.role).toBe("member");
    expect(created.avatarUrl).toBeNull();

    const found = await repo.findByGoogleId("google-new");
    expect(found).toEqual(created);
  });

  it("create は googleId 重複時に GoogleIdAlreadyExistsError をスローする", () => {
    const repo = createInMemoryUserRepository([{ ...baseUser }]);
    expect(() =>
      repo.create({ email: "dup@example.com", googleId: "google-u1", displayName: "Dup" }),
    ).toThrow(GoogleIdAlreadyExistsError);
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
    expect(() => repo.updateProfile("missing", { displayName: "X" })).toThrow(
      "User not found: missing",
    );
  });
});

describe("createTestUserRepository (#455)", () => {
  it("既定で role=admin の dev ユーザーを持ち、email と googleId が設定されている", () => {
    const repo = createTestUserRepository();
    const user = repo.findById("dev-user-1");
    expect(user).not.toBeNull();
  });

  it("findByGoogleId('dev-google-id') で dev ユーザーを取得できる", async () => {
    const repo = createTestUserRepository();
    const user = await repo.findByGoogleId("dev-google-id");
    expect(user).not.toBeNull();
    expect(user?.email).toBe("dev@hatchery.local");
    expect(user?.role).toBe("admin");
  });

  it("role を指定するとそのロールが反映される", async () => {
    const repo = createTestUserRepository("member");
    const user = await repo.findByGoogleId("dev-google-id");
    expect(user?.role).toBe("member");
  });
});
