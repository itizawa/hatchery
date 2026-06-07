import { DEFAULT_CHANNELS, DEFAULT_EMPLOYEES } from "@hatchery/common";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { seedDevData, type SeedPrisma } from "./seedDevData.js";

/** upsert 呼び出しを記録するだけの fake prisma（DB 非依存）。 */
function createFakePrisma() {
  const calls = {
    user: [] as Array<{ id: string; loginId: string; displayName: string }>,
    employee: [] as Array<{ id: string; isBot: boolean; userId: string | null }>,
    channel: [] as Array<{ id: string }>,
    channelEmployee: [] as Array<{ channelId: string; employeeId: string }>,
  };
  const prisma: SeedPrisma = {
    user: {
      async upsert(args) {
        calls.user.push({ id: args.create.id, loginId: args.create.loginId, displayName: args.create.displayName });
      },
    },
    employee: {
      async upsert(args) {
        calls.employee.push({
          id: args.create.id,
          isBot: args.create.isBot,
          userId: args.create.userId ?? null,
        });
      },
    },
    channel: {
      async upsert(args) {
        calls.channel.push({ id: args.create.id });
      },
    },
    channelEmployee: {
      async upsert(args) {
        calls.channelEmployee.push({
          channelId: args.create.channelId,
          employeeId: args.create.employeeId,
        });
      },
    },
  };
  return { prisma, calls };
}

describe("seedDevData", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("AC3: テストユーザー testuser を user.upsert で投入する", async () => {
    const { prisma, calls } = createFakePrisma();
    const result = await seedDevData(prisma);
    expect(result.skipped).toBe(false);
    expect(calls.user).toHaveLength(1);
    expect(calls.user[0]).toEqual({ id: "testuser", loginId: "testuser", displayName: "Test User" });
  });

  it("AC1: DEFAULT_EMPLOYEES 全件を isBot=true / userId=null で投入する（#49）", async () => {
    const { prisma, calls } = createFakePrisma();
    await seedDevData(prisma);
    const aiEmployees = calls.employee.filter((e) =>
      DEFAULT_EMPLOYEES.some((d) => d.id === e.id),
    );
    expect(new Set(aiEmployees.map((e) => e.id))).toEqual(
      new Set(DEFAULT_EMPLOYEES.map((e) => e.id)),
    );
    expect(aiEmployees).toHaveLength(DEFAULT_EMPLOYEES.length);
    expect(aiEmployees.every((e) => e.isBot === true)).toBe(true);
    expect(aiEmployees.every((e) => e.userId === null)).toBe(true);
  });

  it("#49: ログインユーザーに紐づく Employee を isBot=false / userId=testuser で投入する", async () => {
    const { prisma, calls } = createFakePrisma();
    await seedDevData(prisma);
    // AI 社員 3 名 + ユーザー所有社員 1 名。
    expect(calls.employee).toHaveLength(DEFAULT_EMPLOYEES.length + 1);
    const owned = calls.employee.find((e) => e.userId === "testuser");
    expect(owned).toBeDefined();
    expect(owned?.id).toBe("emp-testuser");
    expect(owned?.isBot).toBe(false);
  });

  it("AC2: DEFAULT_CHANNELS 全件を channel.upsert で投入する", async () => {
    const { prisma, calls } = createFakePrisma();
    await seedDevData(prisma);
    expect(new Set(calls.channel.map((c) => c.id))).toEqual(
      new Set(DEFAULT_CHANNELS.map((c) => c.id)),
    );
    expect(calls.channel).toHaveLength(DEFAULT_CHANNELS.length);
  });

  it("AC5: 各 Employee を各 Channel に channelEmployee.upsert で所属付けする", async () => {
    const { prisma, calls } = createFakePrisma();
    await seedDevData(prisma);
    expect(calls.channelEmployee).toHaveLength(
      DEFAULT_EMPLOYEES.length * DEFAULT_CHANNELS.length,
    );
    for (const e of DEFAULT_EMPLOYEES) {
      for (const c of DEFAULT_CHANNELS) {
        expect(calls.channelEmployee).toContainEqual({
          channelId: c.id,
          employeeId: e.id,
        });
      }
    }
  });

  it("AC4: NODE_ENV=production では何も投入せずスキップする", async () => {
    process.env.NODE_ENV = "production";
    const { prisma, calls } = createFakePrisma();
    const result = await seedDevData(prisma);
    expect(result.skipped).toBe(true);
    expect(calls.user).toHaveLength(0);
    expect(calls.employee).toHaveLength(0);
    expect(calls.channel).toHaveLength(0);
    expect(calls.channelEmployee).toHaveLength(0);
  });
});
