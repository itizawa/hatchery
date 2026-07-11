/**
 * admin 手動 post / comment 作成エンドポイントのテスト（#433）。
 * - POST /api/admin/posts: 任意の worker 名義で post 作成（admin のみ）
 * - POST /api/admin/comments: 任意の worker 名義で comment 作成（admin のみ）
 * - 存在しない community / post / worker（削除済み含む）は 404
 * - member は 403、未認証は 401、バリデーション違反は 400
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { COMMENT_TEXT_MAX_LENGTH, POST_TEXT_MAX_LENGTH, POST_TITLE_MAX_LENGTH } from "@hatchery/common";

import { createApp } from "../app.js";
import {
  type CommentRepository,
  createInMemoryCommentRepository,
} from "../persistence/commentRepository.js";
import {
  type CommunityRepository,
  createInMemoryCommunityRepository,
} from "../persistence/communityRepository.js";
import {
  type PostRepository,
  createInMemoryPostRepository,
} from "../persistence/postRepository.js";
import {
  type WorkerRepository,
  createInMemoryWorkerRepository,
} from "../persistence/workerRepository.js";
import { createTestUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

const COMMUNITY_ID = "11111111-1111-1111-1111-111111111111";
const WORKER_ID = "22222222-2222-2222-2222-222222222222";
const DELETED_WORKER_ID = "44444444-4444-4444-4444-444444444444";
const MISSING_UUID = "99999999-9999-9999-9999-999999999999";

interface Repos {
  communityRepo: CommunityRepository;
  postRepo: PostRepository;
  commentRepo: CommentRepository;
  workerRepo: WorkerRepository;
}

function makeRepos(): Repos {
  const communityRepo = createInMemoryCommunityRepository([
    {
      id: COMMUNITY_ID,
      slug: "tech-news",
      name: "テックニュース",
      description: "テクノロジー",
      synopsis: null,
      lastSlotKey: null,
      createdAt: new Date(),
    },
  ]);
  const workerRepo = createInMemoryWorkerRepository([
    { id: WORKER_ID, displayName: "haru", role: null, personality: null },
    {
      id: DELETED_WORKER_ID,
      displayName: "deleted",
      role: null,
      personality: null,
      deletedAt: new Date(),
    },
  ]);
  return {
    communityRepo,
    postRepo: createInMemoryPostRepository(),
    commentRepo: createInMemoryCommentRepository(),
    workerRepo,
  };
}

// eslint-disable-next-line max-params
async function makeApp(repos: Repos, role: "admin" | "member" = "admin") {
  const userRepo = await createTestUserRepository(role);
  return createApp(
    createTestDeps({
      userRepository: userRepo,
      communityRepository: repos.communityRepo,
      postRepository: repos.postRepo,
      commentRepository: repos.commentRepo,
      workerRepository: repos.workerRepo,
    }),
  );
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/dev-login");
  return agent;
}

describe("POST /api/admin/posts (#433)", () => {
  const validBody = {
    communityId: COMMUNITY_ID,
    authorWorkerId: WORKER_ID,
    title: "管理者による手動投稿",
    text: "デモ用に投入したポストです。",
  };

  it("未認証の場合は 401 を返す", async () => {
    const app = await makeApp(makeRepos());
    const res = await request(app).post("/api/admin/posts").send(validBody);
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const app = await makeApp(makeRepos(), "member");
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/posts").send(validBody);
    expect(res.status).toBe(403);
  });

  it("admin ユーザーは 201 と作成した post を返す（author=workerId）", async () => {
    const app = await makeApp(makeRepos());
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/posts").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      communityId: COMMUNITY_ID,
      author: WORKER_ID,
      title: "管理者による手動投稿",
      text: "デモ用に投入したポストです。",
    });
    expect(typeof (res.body as { id: string }).id).toBe("string");
  });

  it("作成した post は manual: プレフィックスの slotKey で永続化される", async () => {
    const app = await makeApp(makeRepos());
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/posts").send(validBody);
    expect((res.body as { slotKey: string }).slotKey.startsWith("manual:")).toBe(true);
  });

  it("作成した post はコミュニティフィードに新着順で表示される", async () => {
    const repos = makeRepos();
    const app = await makeApp(repos);
    const agent = await loginAgent(app);
    await agent.post("/api/admin/posts").send(validBody);
    const feedRes = await request(app).get("/api/communities/tech-news/feed");
    expect(feedRes.status).toBe(200);
    expect(
      (feedRes.body as { posts: Array<{ title: string }> }).posts.some((p) => p.title === validBody.title),
    ).toBe(true);
  });

  it("存在しない community は 404 を返す", async () => {
    const app = await makeApp(makeRepos());
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/posts")
      .send({ ...validBody, communityId: MISSING_UUID });
    expect(res.status).toBe(404);
  });

  it("存在しない worker は 404 を返す", async () => {
    const app = await makeApp(makeRepos());
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/posts")
      .send({ ...validBody, authorWorkerId: MISSING_UUID });
    expect(res.status).toBe(404);
  });

  it("削除済み worker は 404 を返す", async () => {
    const app = await makeApp(makeRepos());
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/posts")
      .send({ ...validBody, authorWorkerId: DELETED_WORKER_ID });
    expect(res.status).toBe(404);
  });

  it("title が空の場合は 400 を返す", async () => {
    const app = await makeApp(makeRepos());
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/posts").send({ ...validBody, title: "" });
    expect(res.status).toBe(400);
  });

  it("communityId が uuid でない場合は 400 を返す", async () => {
    const app = await makeApp(makeRepos());
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/posts").send({ ...validBody, communityId: "abc" });
    expect(res.status).toBe(400);
  });

  it("title が最大文字数を超える場合は 400 を返す", async () => {
    const app = await makeApp(makeRepos());
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/posts")
      .send({ ...validBody, title: "a".repeat(POST_TITLE_MAX_LENGTH + 1) });
    expect(res.status).toBe(400);
  });

  it("text が最大文字数を超える場合は 400 を返す", async () => {
    const app = await makeApp(makeRepos());
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/posts")
      .send({ ...validBody, text: "a".repeat(POST_TEXT_MAX_LENGTH + 1) });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/comments (#433)", () => {
  async function makeAppWithPost(role: "admin" | "member" = "admin") {
    const repos = makeRepos();
    // post を 1 件作っておく（comment の親）
    const [post] = await repos.postRepo.createMany(COMMUNITY_ID, [
      { slotKey: "manual:seed", seq: 0, author: WORKER_ID, title: "親ポスト", text: "本文" },
    ]);
    const app = await makeApp(repos, role);
    return { app, postId: post!.id, repos };
  }

  function validBody(postId: string) {
    return {
      postId,
      authorWorkerId: WORKER_ID,
      text: "デモ用に投入したコメントです。",
    };
  }

  it("未認証の場合は 401 を返す", async () => {
    const { app, postId } = await makeAppWithPost();
    const res = await request(app).post("/api/admin/comments").send(validBody(postId));
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const { app, postId } = await makeAppWithPost("member");
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/comments").send(validBody(postId));
    expect(res.status).toBe(403);
  });

  it("admin ユーザーは 201 と作成した comment を返す（postId の community に紐づく）", async () => {
    const { app, postId } = await makeAppWithPost();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/comments").send(validBody(postId));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      communityId: COMMUNITY_ID,
      postId,
      author: WORKER_ID,
      text: "デモ用に投入したコメントです。",
    });
    expect((res.body as { slotKey: string }).slotKey.startsWith("manual:")).toBe(true);
  });

  it("作成した comment はスレッド取得 API に表示される", async () => {
    const { app, postId } = await makeAppWithPost();
    const agent = await loginAgent(app);
    await agent.post("/api/admin/comments").send(validBody(postId));
    const threadRes = await request(app).get(`/api/posts/${postId}`);
    expect(threadRes.status).toBe(200);
    expect(
      (threadRes.body as { comments: Array<{ text: string }> }).comments.some(
        (c) => c.text === "デモ用に投入したコメントです。",
      ),
    ).toBe(true);
  });

  it("存在しない post は 404 を返す", async () => {
    const { app } = await makeAppWithPost();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/comments").send(validBody(MISSING_UUID));
    expect(res.status).toBe(404);
  });

  it("存在しない worker は 404 を返す", async () => {
    const { app, postId } = await makeAppWithPost();
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/comments")
      .send({ ...validBody(postId), authorWorkerId: MISSING_UUID });
    expect(res.status).toBe(404);
  });

  it("削除済み worker は 404 を返す", async () => {
    const { app, postId } = await makeAppWithPost();
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/comments")
      .send({ ...validBody(postId), authorWorkerId: DELETED_WORKER_ID });
    expect(res.status).toBe(404);
  });

  it("text が空の場合は 400 を返す", async () => {
    const { app, postId } = await makeAppWithPost();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/comments").send({ ...validBody(postId), text: "" });
    expect(res.status).toBe(400);
  });

  it("postId が uuid でない場合は 400 を返す", async () => {
    const { app } = await makeAppWithPost();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/comments").send({ ...validBody("abc"), postId: "abc" });
    expect(res.status).toBe(400);
  });

  it("text が最大文字数を超える場合は 400 を返す", async () => {
    const { app, postId } = await makeAppWithPost();
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/comments")
      .send({ ...validBody(postId), text: "a".repeat(COMMENT_TEXT_MAX_LENGTH + 1) });
    expect(res.status).toBe(400);
  });
});

describe("POST/DELETE /api/admin/posts/:id/pin (#1089)", () => {
  async function makeAppWithPosts(count: number, role: "admin" | "member" = "admin") {
    const repos = makeRepos();
    const posts = await repos.postRepo.createMany(
      COMMUNITY_ID,
      Array.from({ length: count }, (_, i) => ({
        slotKey: "manual:seed",
        seq: i,
        author: WORKER_ID,
        title: `投稿${i}`,
        text: "本文",
      })),
    );
    const app = await makeApp(repos, role);
    return { app, posts, repos };
  }

  it("未認証の場合は 401 を返す", async () => {
    const { app, posts } = await makeAppWithPosts(1);
    const res = await request(app).post(`/api/admin/posts/${posts[0]!.id}/pin`);
    expect(res.status).toBe(401);
  });

  it("member ユーザーは 403 を返す", async () => {
    const { app, posts } = await makeAppWithPosts(1, "member");
    const agent = await loginAgent(app);
    const res = await agent.post(`/api/admin/posts/${posts[0]!.id}/pin`);
    expect(res.status).toBe(403);
  });

  it("admin ユーザーは 200 と is_pinned: true を返す", async () => {
    const { app, posts } = await makeAppWithPosts(1);
    const agent = await loginAgent(app);
    const res = await agent.post(`/api/admin/posts/${posts[0]!.id}/pin`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: posts[0]!.id, is_pinned: true });
  });

  it("存在しない post は 404 を返す", async () => {
    const { app } = await makeAppWithPosts(0);
    const agent = await loginAgent(app);
    const res = await agent.post(`/api/admin/posts/${MISSING_UUID}/pin`);
    expect(res.status).toBe(404);
  });

  it(`community あたり pin 済みが既に上限（3件）ある場合は 409 を返す`, async () => {
    const { app, posts } = await makeAppWithPosts(4);
    const agent = await loginAgent(app);
    await agent.post(`/api/admin/posts/${posts[0]!.id}/pin`);
    await agent.post(`/api/admin/posts/${posts[1]!.id}/pin`);
    await agent.post(`/api/admin/posts/${posts[2]!.id}/pin`);
    const res = await agent.post(`/api/admin/posts/${posts[3]!.id}/pin`);
    expect(res.status).toBe(409);
  });

  it("未認証で unpin を呼ぶと 401 を返す", async () => {
    const { app, posts } = await makeAppWithPosts(1);
    const res = await request(app).delete(`/api/admin/posts/${posts[0]!.id}/pin`);
    expect(res.status).toBe(401);
  });

  it("member が unpin を呼ぶと 403 を返す", async () => {
    const { app, posts } = await makeAppWithPosts(1, "member");
    const agent = await loginAgent(app);
    const res = await agent.delete(`/api/admin/posts/${posts[0]!.id}/pin`);
    expect(res.status).toBe(403);
  });

  it("admin が unpin すると 200 と is_pinned: false を返す", async () => {
    const { app, posts } = await makeAppWithPosts(1);
    const agent = await loginAgent(app);
    await agent.post(`/api/admin/posts/${posts[0]!.id}/pin`);
    const res = await agent.delete(`/api/admin/posts/${posts[0]!.id}/pin`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: posts[0]!.id, is_pinned: false });
  });

  it("未 pin の post を unpin しても冪等に 200 を返す", async () => {
    const { app, posts } = await makeAppWithPosts(1);
    const agent = await loginAgent(app);
    const res = await agent.delete(`/api/admin/posts/${posts[0]!.id}/pin`);
    expect(res.status).toBe(200);
  });

  it("存在しない post を unpin すると 404 を返す", async () => {
    const { app } = await makeAppWithPosts(0);
    const agent = await loginAgent(app);
    const res = await agent.delete(`/api/admin/posts/${MISSING_UUID}/pin`);
    expect(res.status).toBe(404);
  });
});
