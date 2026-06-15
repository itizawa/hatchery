import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { GoogleIdAlreadyExistsError } from "./userRepository.js";
import { createPrismaUserRepository } from "./prismaUserRepository.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("createPrismaUserRepository (integration)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.user.deleteMany();
  });

  describe("create", () => {
    it("全フィールドが正確に保存され role は 'member' になる", async () => {
      const repo = createPrismaUserRepository(prisma);

      const user = await repo.create({
        email: "test@example.com",
        googleId: "google-001",
        displayName: "テストユーザー",
      });

      expect(user.email).toBe("test@example.com");
      expect(user.googleId).toBe("google-001");
      expect(user.displayName).toBe("テストユーザー");
      expect(user.role).toBe("member");
      expect(user.avatarUrl).toBeNull();
      expect(user.id).toBeDefined();
    });

    it("重複した googleId は GoogleIdAlreadyExistsError を throw する", async () => {
      const repo = createPrismaUserRepository(prisma);
      await repo.create({
        email: "first@example.com",
        googleId: "google-dup",
        displayName: "先客",
      });

      await expect(
        repo.create({
          email: "second@example.com",
          googleId: "google-dup",
          displayName: "後客",
        }),
      ).rejects.toThrow(GoogleIdAlreadyExistsError);
    });
  });

  describe("findById", () => {
    it("存在する id でユーザーを返す", async () => {
      const repo = createPrismaUserRepository(prisma);
      const created = await repo.create({
        email: "find@example.com",
        googleId: "google-find",
        displayName: "検索対象",
      });

      const found = await repo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe("find@example.com");
    });

    it("存在しない id は null を返す", async () => {
      const repo = createPrismaUserRepository(prisma);

      const result = await repo.findById("nonexistent-id");

      expect(result).toBeNull();
    });
  });

  describe("findByGoogleId", () => {
    it("存在する googleId でユーザーを返す", async () => {
      const repo = createPrismaUserRepository(prisma);
      await repo.create({
        email: "google@example.com",
        googleId: "google-lookup",
        displayName: "Google検索",
      });

      const found = await repo.findByGoogleId("google-lookup");

      expect(found).not.toBeNull();
      expect(found?.googleId).toBe("google-lookup");
    });

    it("存在しない googleId は null を返す", async () => {
      const repo = createPrismaUserRepository(prisma);

      const result = await repo.findByGoogleId("nonexistent-google-id");

      expect(result).toBeNull();
    });
  });

  describe("updateProfile", () => {
    it("displayName が反映され avatarUrl は null のまま保持される", async () => {
      const repo = createPrismaUserRepository(prisma);
      const created = await repo.create({
        email: "update@example.com",
        googleId: "google-update",
        displayName: "旧名前",
      });

      const updated = await repo.updateProfile(created.id, { displayName: "新名前" });

      expect(updated.displayName).toBe("新名前");
      expect(updated.avatarUrl).toBeNull();
    });

    it("avatarUrl が反映される", async () => {
      const repo = createPrismaUserRepository(prisma);
      const created = await repo.create({
        email: "avatar@example.com",
        googleId: "google-avatar",
        displayName: "アバターユーザー",
      });

      const updated = await repo.updateProfile(created.id, {
        displayName: "アバターユーザー",
        avatarUrl: "https://example.com/avatar.png",
      });

      expect(updated.avatarUrl).toBe("https://example.com/avatar.png");
    });

    it("存在しない id は Error を throw する（P2025）", async () => {
      const repo = createPrismaUserRepository(prisma);

      await expect(
        repo.updateProfile("nonexistent-id", { displayName: "幻の更新" }),
      ).rejects.toThrow("User not found: nonexistent-id");
    });
  });

  describe("role マッピング", () => {
    it("DB の role 文字列 'member' が UserRole 型に正しく変換される", async () => {
      const repo = createPrismaUserRepository(prisma);
      const created = await repo.create({
        email: "role@example.com",
        googleId: "google-role",
        displayName: "ロールユーザー",
      });

      const found = await repo.findById(created.id);

      expect(found?.role).toBe("member");
    });

    it("DB の role 文字列 'admin' が UserRole 型に正しく変換される", async () => {
      const repo = createPrismaUserRepository(prisma);
      const created = await repo.create({
        email: "admin@example.com",
        googleId: "google-admin",
        displayName: "管理者",
      });
      await prisma.user.update({ where: { id: created.id }, data: { role: "admin" } });

      const found = await repo.findById(created.id);

      expect(found?.role).toBe("admin");
    });
  });
});
