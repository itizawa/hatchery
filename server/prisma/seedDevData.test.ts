import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { seedDevData, type SeedPrisma } from "./seedDevData.js";

/** upsert 呼び出しを記録するだけの fake prisma（DB 非依存）。 */
function createFakePrisma() {
  const calls = {
    user: [] as Array<{ id: string; loginId: string; displayName: string }>,
    employee: [] as Array<{ id: string; isBot: boolean; userId: string | null }>,
    community: [] as Array<{ slug: string; name: string }>,
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
    community: {
      async upsert(args) {
        calls.community.push({ slug: args.create.slug, name: args.create.name });
      },
    },
  };
  return { prisma, calls };
}

/** MVP コミュニティの slugs（seedDevData.ts 内の DEFAULT_COMMUNITIES に対応） */
const EXPECTED_COMMUNITY_SLUGS = ["technology", "daily"] as const;
/** MVP AI ワーカーの ids（seedDevData.ts 内の DEFAULT_WORKERS に対応） */
const EXPECTED_WORKER_IDS = ["worker-alice", "worker-bob", "worker-carol"] as const;

describe("seedDevData (#305)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("テストユーザー testuser を user.upsert で投入する", async () => {
    const { prisma, calls } = createFakePrisma();
    const result = await seedDevData(prisma);
    expect(result.skipped).toBe(false);
    expect(calls.user).toHaveLength(1);
    expect(calls.user[0]).toEqual({ id: "testuser", loginId: "testuser", displayName: "Test User" });
  });

  it("AI ワーカー 3 名を isBot=true / userId=null で投入する（ADR-0019）", async () => {
    const { prisma, calls } = createFakePrisma();
    await seedDevData(prisma);
    const aiWorkers = calls.employee.filter((e) =>
      EXPECTED_WORKER_IDS.includes(e.id as typeof EXPECTED_WORKER_IDS[number]),
    );
    expect(aiWorkers).toHaveLength(EXPECTED_WORKER_IDS.length);
    expect(aiWorkers.every((e) => e.isBot === true)).toBe(true);
    expect(aiWorkers.every((e) => e.userId === null)).toBe(true);
  });

  it("ログインユーザーに紐づく Employee を isBot=false / userId=testuser で投入する（#49）", async () => {
    const { prisma, calls } = createFakePrisma();
    await seedDevData(prisma);
    // AI ワーカー 3 名 + ユーザー所有社員 1 名
    expect(calls.employee).toHaveLength(EXPECTED_WORKER_IDS.length + 1);
    const owned = calls.employee.find((e) => e.userId === "testuser");
    expect(owned).toBeDefined();
    expect(owned?.id).toBe("emp-testuser");
    expect(owned?.isBot).toBe(false);
  });

  it("MVP コミュニティ 2 件を community.upsert で投入する（#305 / ADR-0019）", async () => {
    const { prisma, calls } = createFakePrisma();
    await seedDevData(prisma);
    expect(calls.community).toHaveLength(EXPECTED_COMMUNITY_SLUGS.length);
    const slugs = calls.community.map((c) => c.slug);
    for (const slug of EXPECTED_COMMUNITY_SLUGS) {
      expect(slugs).toContain(slug);
    }
  });

  it("NODE_ENV=production では何も投入せずスキップする", async () => {
    process.env.NODE_ENV = "production";
    const { prisma, calls } = createFakePrisma();
    const result = await seedDevData(prisma);
    expect(result.skipped).toBe(true);
    expect(calls.user).toHaveLength(0);
    expect(calls.employee).toHaveLength(0);
    expect(calls.community).toHaveLength(0);
  });
});
