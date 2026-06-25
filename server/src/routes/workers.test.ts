import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryViewRepository } from "../persistence/viewRepository.js";
import { createInMemoryVoteRepository } from "../persistence/voteRepository.js";
import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import { createInMemoryWorkerCommunityRepository } from "../persistence/workerCommunityRepository.js";
import type { CommunityRecord } from "../persistence/communityRepository.js";
import type { WorkerRecord } from "../persistence/workerRepository.js";

const WORKER_ID = "wrk-testworker";

async function buildApp(workerRepository = createInMemoryWorkerRepository()) {
  const userRepository = await createTestUserRepository("admin");
  const app = createApp(
    await createTestDeps({
      userRepository,
      workerRepository,
    }),
  );
  return { app, workerRepository };
}

async function buildAppWithMember(workerRepository = createInMemoryWorkerRepository()) {
  const userRepository = await createTestUserRepository("member");
  const app = createApp(
    await createTestDeps({
      userRepository,
      workerRepository,
    }),
  );
  return { app, workerRepository };
}

async function loginAsAdmin(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/dev-login");
  return agent;
}

async function loginAsMember(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/dev-login");
  return agent;
}

describe("PATCH /api/workers/:id（admin のみ更新可 / #181）", () => {
  describe("認証", () => {
    it("①未認証だと 401 を返す", async () => {
      const { app } = await buildApp(
        createInMemoryWorkerRepository([
          { id: WORKER_ID, displayName: "Worker", role: null, personality: null, imageUrl: null },
        ]),
      );
      const res = await request(app)
        .patch(`/api/workers/${WORKER_ID}`)
        .send({ displayName: "新名前" });
      expect(res.status).toBe(401);
    });
  });

  describe("認可", () => {
    it("②admin は更新できて 200 を返す", async () => {
      const { app } = await buildApp(
        createInMemoryWorkerRepository([
          { id: WORKER_ID, displayName: "Worker", role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent
        .patch(`/api/workers/${WORKER_ID}`)
        .send({ displayName: "Updated Worker" });
      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe("Updated Worker");
    });

    it("③member は更新できず 403 を返す", async () => {
      const { app } = await buildAppWithMember(
        createInMemoryWorkerRepository([
          { id: WORKER_ID, displayName: "Worker", role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsMember(app);
      const res = await agent
        .patch(`/api/workers/${WORKER_ID}`)
        .send({ displayName: "試み" });
      expect(res.status).toBe(403);
    });
  });

  describe("正常系", () => {
    it("admin が displayName / role / personality を更新すると 200 で更新後の Worker を返す", async () => {
      const { app } = await buildApp(
        createInMemoryWorkerRepository([
          { id: WORKER_ID, displayName: "Worker", role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent
        .patch(`/api/workers/${WORKER_ID}`)
        .send({ displayName: "新表示名", role: "リーダー", personality: "陽気な性格" });
      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe("新表示名");
      expect(res.body.role).toBe("リーダー");
      expect(res.body.personality).toBe("陽気な性格");
    });
  });

  describe("存在しないリソース", () => {
    it("④不存在 Worker への更新は 404 を返す", async () => {
      const { app } = await buildApp(createInMemoryWorkerRepository([]));
      const agent = await loginAsAdmin(app);
      const res = await agent.patch("/api/workers/non-existent-id").send({ displayName: "test" });
      expect(res.status).toBe(404);
    });
  });

  describe("バリデーション", () => {
    it("⑤displayName が 51 文字なら 400 を返す", async () => {
      const { app } = await buildApp(
        createInMemoryWorkerRepository([
          { id: WORKER_ID, displayName: "Worker", role: null, personality: null, imageUrl: null },
        ]),
      );
      const agent = await loginAsAdmin(app);
      const res = await agent
        .patch(`/api/workers/${WORKER_ID}`)
        .send({ displayName: "a".repeat(51) });
      expect(res.status).toBe(400);
    });
  });
});

describe("GET /api/workers（Bot Worker 一覧 / #240）", () => {
  it("認証不要で 200 を返す", async () => {
    const { app } = await buildApp(
      createInMemoryWorkerRepository([
        { id: "bot1", displayName: "Bot", role: "役職", personality: null, imageUrl: null },
      ]),
    );
    const res = await request(app).get("/api/workers");
    expect(res.status).toBe(200);
  });

  // #331: ADR-0020 後処理。Worker は AI 投稿者のみとなり isBot フィルタを撤廃した（全 Worker を返す）。
  it("全 Worker を配列で返す（#331・isBot フィルタ撤廃）", async () => {
    const { app } = await buildApp(
      createInMemoryWorkerRepository([
        { id: "bot1", displayName: "BotA", role: null, personality: null, imageUrl: null },
        { id: "bot2", displayName: "BotB", role: null, personality: null, imageUrl: null },
      ]),
    );
    const res = await request(app).get("/api/workers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.workers)).toBe(true);
    expect(res.body.workers.map((w: { id: string }) => w.id).sort()).toEqual(["bot1", "bot2"]);
    expect(res.body.workers.every((w: object) => !("isBot" in w))).toBe(true);
  });

  it("Bot が存在しない場合は空配列を返す", async () => {
    const { app } = await buildApp(createInMemoryWorkerRepository([]));
    const res = await request(app).get("/api/workers");
    expect(res.status).toBe(200);
    expect(res.body.workers).toEqual([]);
  });

  it("論理削除済み Bot は通常一覧に含まれない（#218）", async () => {
    const { app } = await buildApp(
      createInMemoryWorkerRepository([
        { id: "bot1", displayName: "BotA", role: null, personality: null, deletedAt: new Date() },
      ]),
    );
    const res = await request(app).get("/api/workers");
    expect(res.status).toBe(200);
    expect(res.body.workers).toEqual([]);
  });

  it("includeDeleted=true を指定すると論理削除済み Bot も含まれる（#218）", async () => {
    const { app } = await buildApp(
      createInMemoryWorkerRepository([
        { id: "bot1", displayName: "ActiveBot", role: null, personality: null },
        { id: "bot2", displayName: "DeletedBot", role: null, personality: null, deletedAt: new Date() },
      ]),
    );
    const res = await request(app).get("/api/workers?includeDeleted=true");
    expect(res.status).toBe(200);
    expect(res.body.workers.map((w: { id: string }) => w.id).sort()).toEqual(["bot1", "bot2"]);
  });
});

describe("GET /api/workers/:workerId（ワーカー詳細・#929）", () => {
  it("存在するワーカー ID で 200 + ワーカー詳細を返す", async () => {
    const workerRepo = createInMemoryWorkerRepository([
      { id: "worker-abc", displayName: "あおい", role: "データサイエンティスト", personality: "論理的" },
    ]);
    const deps = createTestDeps({ workerRepository: workerRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/workers/worker-abc");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: "worker-abc",
      displayName: "あおい",
      role: "データサイエンティスト",
      personality: "論理的",
    });
  });

  it("存在しないワーカー ID で 404 を返す", async () => {
    const deps = createTestDeps({ workerRepository: createInMemoryWorkerRepository([]) });
    const app = createApp(deps);

    const res = await request(app).get("/api/workers/nonexistent");
    expect(res.status).toBe(404);
  });

  it("論理削除済みワーカーは 404 を返す", async () => {
    const workerRepo = createInMemoryWorkerRepository([
      { id: "deleted-w", displayName: "削除済み", role: null, personality: null, deletedAt: new Date("2026-01-01") },
    ]);
    const deps = createTestDeps({ workerRepository: workerRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/workers/deleted-w");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/workers/:workerId/posts（ワーカー投稿一覧・#929）", () => {
  it("存在するワーカーの投稿を新着順で返す", async () => {
    const workerRepo = createInMemoryWorkerRepository([
      { id: "worker-1", displayName: "あおい", role: null, personality: null },
    ]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      {
        slotKey: "2026-06-10T09:00",
        seq: 0,
        author: "worker-1",
        title: "新しい投稿",
        text: "テキスト",
        createdAt: new Date("2026-06-10T09:00:00Z"),
      },
      {
        slotKey: "2026-06-09T09:00",
        seq: 0,
        author: "worker-1",
        title: "古い投稿",
        text: "テキスト",
        createdAt: new Date("2026-06-09T09:00:00Z"),
      },
      {
        slotKey: "2026-06-10T09:00",
        seq: 1,
        author: "other-worker",
        title: "別ワーカーの投稿",
        text: "テキスト",
        createdAt: new Date("2026-06-10T09:01:00Z"),
      },
    ]);
    const deps = createTestDeps({ workerRepository: workerRepo, postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/workers/worker-1/posts");
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(2);
    expect(res.body.posts[0].title).toBe("新しい投稿");
    expect(res.body.posts[1].title).toBe("古い投稿");
  });

  it("reveal フィルタ: 未来の createdAt を持つ post は除外される", async () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 60 * 60 * 1000);
    const pastDate = new Date(now.getTime() - 60 * 60 * 1000);

    const workerRepo = createInMemoryWorkerRepository([
      { id: "worker-1", displayName: "あおい", role: null, personality: null },
    ]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "slot-past", seq: 0, author: "worker-1", title: "過去の投稿", text: "テキスト", createdAt: pastDate },
      { slotKey: "slot-future", seq: 0, author: "worker-1", title: "未来の投稿", text: "テキスト", createdAt: futureDate },
    ]);
    const deps = createTestDeps({ workerRepository: workerRepo, postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/workers/worker-1/posts");
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].title).toBe("過去の投稿");
  });

  it("存在しないワーカーで 404 を返す", async () => {
    const deps = createTestDeps({ workerRepository: createInMemoryWorkerRepository([]) });
    const app = createApp(deps);

    const res = await request(app).get("/api/workers/nonexistent/posts");
    expect(res.status).toBe(404);
  });

  it("ワーカーに投稿がない場合は空配列を返す", async () => {
    const workerRepo = createInMemoryWorkerRepository([
      { id: "worker-1", displayName: "あおい", role: null, personality: null },
    ]);
    const deps = createTestDeps({ workerRepository: workerRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/workers/worker-1/posts");
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(0);
  });
});

describe("GET /api/workers/ranking（ワーカーランキング・#665）", () => {
  it("ランキング一覧を返す（認証不要）", async () => {
    const workerRepo = createInMemoryWorkerRepository([
      { id: "w1", displayName: "Worker Alpha", role: null, personality: null, imageUrl: null },
    ]);
    const viewRepo = createInMemoryViewRepository();
    const voteRepo = createInMemoryVoteRepository();
    const deps = await createTestDeps({ workerRepository: workerRepo, viewRepository: viewRepo, voteRepository: voteRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/workers/ranking");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("workers");
    expect(Array.isArray(res.body.workers)).toBe(true);
  });

  it("workers 配列には worker_id / display_name / view_count / vote_net_score が含まれる", async () => {
    const workerRepo = createInMemoryWorkerRepository([
      { id: "w1", displayName: "Worker Alpha", role: null, personality: null, imageUrl: null },
    ]);
    const viewRepo = createInMemoryViewRepository();
    const voteRepo = createInMemoryVoteRepository();
    const deps = await createTestDeps({ workerRepository: workerRepo, viewRepository: viewRepo, voteRepository: voteRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/workers/ranking");
    expect(res.status).toBe(200);
    res.body.workers.forEach((item: unknown) => {
      const w = item as Record<string, unknown>;
      expect(w).toHaveProperty("worker_id");
      expect(w).toHaveProperty("display_name");
      expect(w).toHaveProperty("view_count");
      expect(w).toHaveProperty("vote_net_score");
    });
  });

  it("データがない場合は workers: [] を返す（空状態）", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);

    const res = await request(app).get("/api/workers/ranking");
    expect(res.status).toBe(200);
    expect(res.body.workers).toEqual([]);
  });
});

const COMMUNITY_RECORD: CommunityRecord = {
  id: "comm-1",
  slug: "ai-lab",
  name: "AI Lab",
  description: "AI コミュニティ",
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  generationInstruction: null,
  feedUrl: null,
  createdAt: new Date("2024-01-01"),
};

const WORKER_RECORD: WorkerRecord = {
  id: WORKER_ID,
  displayName: "テストワーカー",
  role: "エンジニア",
  personality: null,
  verbosity: "standard",
  imageUrl: null,
  deletedAt: null,
};

describe("GET /api/workers/:id/communities (#690)", () => {
  it("ワーカーの所属コミュニティ一覧を返す（認証不要）", async () => {
    const workerRepo = createInMemoryWorkerRepository([WORKER_RECORD]);
    const communityRepo = createInMemoryCommunityRepository([COMMUNITY_RECORD]);
    const workerCommunityRepo = createInMemoryWorkerCommunityRepository({
      workers: [WORKER_RECORD],
      links: [{ workerId: WORKER_ID, communityId: "comm-1" }],
    });
    const app = createApp(createTestDeps({ workerRepository: workerRepo, communityRepository: communityRepo, workerCommunityRepository: workerCommunityRepo }));
    const res = await request(app).get(`/api/workers/${WORKER_ID}/communities`);
    expect(res.status).toBe(200);
    expect(res.body.communities).toHaveLength(1);
    expect(res.body.communities[0].slug).toBe("ai-lab");
  });

  it("所属コミュニティが 0 件のとき空配列を返す", async () => {
    const workerRepo = createInMemoryWorkerRepository([WORKER_RECORD]);
    const app = createApp(createTestDeps({ workerRepository: workerRepo }));
    const res = await request(app).get(`/api/workers/${WORKER_ID}/communities`);
    expect(res.status).toBe(200);
    expect(res.body.communities).toEqual([]);
  });

  it("ワーカーが存在しない場合は 404 を返す", async () => {
    const app = createApp(createTestDeps());
    const res = await request(app).get("/api/workers/nonexistent/communities");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/workers/:id/comments (#690)", () => {
  it("ワーカーのコメント一覧を返す（認証不要）", async () => {
    const workerRepo = createInMemoryWorkerRepository([WORKER_RECORD]);
    const commentRepo = createInMemoryCommentRepository();
    await commentRepo.createMany("comm-1", [
      { postId: "post-1", slotKey: "s", seq: 0, author: WORKER_ID, text: "Hello world" },
    ]);
    const app = createApp(createTestDeps({ workerRepository: workerRepo, commentRepository: commentRepo }));
    const res = await request(app).get(`/api/workers/${WORKER_ID}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].text).toBe("Hello world");
    expect(res.body).toHaveProperty("nextCursor");
  });

  it("コメントが 0 件のとき空配列と nextCursor null を返す", async () => {
    const workerRepo = createInMemoryWorkerRepository([WORKER_RECORD]);
    const app = createApp(createTestDeps({ workerRepository: workerRepo }));
    const res = await request(app).get(`/api/workers/${WORKER_ID}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.comments).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });

  it("ワーカーが存在しない場合は 404 を返す", async () => {
    const app = createApp(createTestDeps());
    const res = await request(app).get("/api/workers/nonexistent/comments");
    expect(res.status).toBe(404);
  });

  it("limit クエリパラメータでページネーション件数を制御できる", async () => {
    const workerRepo = createInMemoryWorkerRepository([WORKER_RECORD]);
    const commentRepo = createInMemoryCommentRepository();
    await commentRepo.createMany("comm-1", [
      { postId: "p", slotKey: "s", seq: 0, author: WORKER_ID, text: "c1", createdAt: new Date("2024-01-01") },
      { postId: "p", slotKey: "s", seq: 1, author: WORKER_ID, text: "c2", createdAt: new Date("2024-02-01") },
      { postId: "p", slotKey: "s", seq: 2, author: WORKER_ID, text: "c3", createdAt: new Date("2024-03-01") },
    ]);
    const app = createApp(createTestDeps({ workerRepository: workerRepo, commentRepository: commentRepo }));
    const res = await request(app).get(`/api/workers/${WORKER_ID}/comments?limit=2`);
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(2);
    expect(res.body.nextCursor).not.toBeNull();
  });
});
