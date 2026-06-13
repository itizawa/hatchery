import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { seedDevData, type SeedPrisma } from "./seedDevData.js";

/** upsert 呼び出しを記録するだけの fake prisma（DB 非依存）。 */
function createFakePrisma() {
  const calls = {
    user: [] as Array<{ id: string; email: string; googleId: string; displayName: string }>,
    worker: [] as Array<{ id: string; role: string | null }>,
    community: [] as Array<{ slug: string; name: string }>,
  };
  const prisma: SeedPrisma = {
    user: {
      async upsert(args) {
        calls.user.push({ id: args.create.id, email: args.create.email, googleId: args.create.googleId, displayName: args.create.displayName });
      },
    },
    worker: {
      async upsert(args) {
        calls.worker.push({
          id: args.create.id,
          role: args.create.role,
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

describe("seedDevData (#305 / #329 / #455)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("dev ユーザーを email / googleId で user.upsert する（#455）", async () => {
    const { prisma, calls } = createFakePrisma();
    const result = await seedDevData(prisma);
    expect(result.skipped).toBe(false);
    expect(calls.user).toHaveLength(1);
    expect(calls.user[0]).toEqual({
      id: "dev-user-1",
      email: "dev@hatchery.local",
      googleId: "dev-google-id",
      displayName: "claude-dev",
    });
  });

  it("AI ワーカー 3 名を worker.upsert で投入する（ADR-0019 / #455: isBot/userId 廃止）", async () => {
    const { prisma, calls } = createFakePrisma();
    await seedDevData(prisma);
    expect(calls.worker).toHaveLength(EXPECTED_WORKER_IDS.length);
    const ids = calls.worker.map((w) => w.id);
    for (const id of EXPECTED_WORKER_IDS) {
      expect(ids).toContain(id);
    }
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
    expect(calls.worker).toHaveLength(0);
    expect(calls.community).toHaveLength(0);
  });
});
