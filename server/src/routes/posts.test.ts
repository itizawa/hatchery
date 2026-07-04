import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemoryVoteRepository } from "../persistence/voteRepository.js";
import { createInMemoryViewRepository } from "../persistence/viewRepository.js";
import { createInMemoryWorkerRepository } from "../persistence/workerRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

describe("GET /api/posts/:postId", () => {
  it("post + comments のスレッドを取得できる（認証不要）", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Thread Title", text: "Thread Text" },
    ]);
    await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-2", text: "Reply" },
    ]);

    const deps = await createTestDeps({
      postRepository: postRepo,
      commentRepository: commentRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get(`/api/posts/${post.id}`);
    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({ id: post.id, title: "Thread Title" });
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0]).toMatchObject({ text: "Reply" });
  });

  it("レスポンスのフィールド名が OpenAPI スキーマ（snake_case）と一致し camelCase を含まない（#499）", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "T", text: "Body" },
    ]);
    await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-2", text: "Reply" },
    ]);

    const deps = await createTestDeps({
      postRepository: postRepo,
      commentRepository: commentRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get(`/api/posts/${post.id}`);
    expect(res.status).toBe(200);

    // post は community_id / slot_key / created_at（snake_case）を持ち camelCase を持たない
    expect(res.body.post).toHaveProperty("community_id", "community-1");
    expect(res.body.post).toHaveProperty("slot_key");
    expect(res.body.post).toHaveProperty("created_at");
    expect(res.body.post).not.toHaveProperty("communityId");
    expect(res.body.post).not.toHaveProperty("slotKey");
    expect(res.body.post).not.toHaveProperty("createdAt");

    // comment は community_id / post_id（snake_case）を持ち camelCase を持たない
    const comment = res.body.comments[0];
    expect(comment).toHaveProperty("community_id", "community-1");
    expect(comment).toHaveProperty("post_id", post.id);
    expect(comment).not.toHaveProperty("communityId");
    expect(comment).not.toHaveProperty("postId");
    expect(comment).not.toHaveProperty("slotKey");
    expect(comment).not.toHaveProperty("createdAt");
  });

  it("存在しない post は 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/posts/not-exists");
    expect(res.status).toBe(404);
  });

  it("コメントが N 件ある post を取得すると comment_count: N が返る（#779）", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();

    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "T", text: "Body" },
    ]);
    await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-2", text: "Reply 1" },
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 1, author: "worker-3", text: "Reply 2" },
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 2, author: "worker-4", text: "Reply 3" },
    ]);

    const deps = await createTestDeps({ postRepository: postRepo, commentRepository: commentRepo });
    const app = createApp(deps);

    const res = await request(app).get(`/api/posts/${post.id}`);
    expect(res.status).toBe(200);
    expect(res.body.post.comment_count).toBe(3);
  });

  it("コメントが 0 件の post を取得すると comment_count: 0 が返る（#779）", async () => {
    const postRepo = createInMemoryPostRepository();

    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "T", text: "Body" },
    ]);

    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app).get(`/api/posts/${post.id}`);
    expect(res.status).toBe(200);
    expect(res.body.post.comment_count).toBe(0);
  });

  it("post と各 comment に author_worker（display_name + image_url）を付与する（#479）", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "haru", title: "T", text: "Body" },
    ]);
    await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "uuid-ken", text: "Reply" },
    ]);
    const workerRepo = createInMemoryWorkerRepository([
      { id: "uuid-haru", displayName: "haru", role: null, personality: null, imageUrl: "https://example.com/haru.png" },
      { id: "uuid-ken", displayName: "ken", role: null, personality: null, imageUrl: null },
    ]);

    const deps = await createTestDeps({
      postRepository: postRepo,
      commentRepository: commentRepo,
      workerRepository: workerRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get(`/api/posts/${post.id}`);
    expect(res.status).toBe(200);
    expect(res.body.post.author_worker).toEqual({
      id: "uuid-haru",
      display_name: "haru",
      image_url: "https://example.com/haru.png",
    });
    expect(res.body.comments[0].author_worker).toEqual({
      id: "uuid-ken",
      display_name: "ken",
      image_url: null,
    });
  });

  it("解決できない author の comment には author_worker を付与しない（#479）", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "unknown-author", title: "T", text: "Body" },
    ]);
    await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "unknown-commenter", text: "Reply" },
    ]);

    const deps = await createTestDeps({
      postRepository: postRepo,
      commentRepository: commentRepo,
    });
    const app = createApp(deps);

    const res = await request(app).get(`/api/posts/${post.id}`);
    expect(res.body.post.author_worker).toBeUndefined();
    expect(res.body.comments[0].author_worker).toBeUndefined();
  });
});

describe("POST /api/posts/:postId/vote", () => {
  async function loginAndGetCookie(app: Express.Application) {
    const loginRes = await request(app).post("/api/auth/dev-login");
    return loginRes.headers["set-cookie"] as string[];
  }

  it("direction=up で post に up vote できる（score +1）", async () => {
    const postRepo = createInMemoryPostRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);
    const cookie = await loginAndGetCookie(app);

    const res = await request(app)
      .post(`/api/posts/${post.id}/vote`)
      .send({ direction: "up", sessionId: "00000000-0000-0000-0000-000000000010" })
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: 1 });
  });

  it("direction=down で post に down vote できる（score -1）", async () => {
    const postRepo = createInMemoryPostRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);
    const cookie = await loginAndGetCookie(app);

    const res = await request(app)
      .post(`/api/posts/${post.id}/vote`)
      .send({ direction: "down", sessionId: "00000000-0000-0000-0000-000000000011" })
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: -1 });
  });

  it("up 済みに再度 up で toggle off（score 0）", async () => {
    const postRepo = createInMemoryPostRepository();
    const voteRepo = createInMemoryVoteRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo, voteRepository: voteRepo });
    const app = createApp(deps);
    const cookie = await loginAndGetCookie(app);

    await request(app).post(`/api/posts/${post.id}/vote`).send({ direction: "up", sessionId: "00000000-0000-0000-0000-000000000012" }).set("Cookie", cookie);
    const res = await request(app).post(`/api/posts/${post.id}/vote`).send({ direction: "up", sessionId: "00000000-0000-0000-0000-000000000012" }).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: 0 });
  });

  it("up 済みに down で switch（score 0-2 = -1）", async () => {
    const postRepo = createInMemoryPostRepository();
    const voteRepo = createInMemoryVoteRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo, voteRepository: voteRepo });
    const app = createApp(deps);
    const cookie = await loginAndGetCookie(app);

    await request(app).post(`/api/posts/${post.id}/vote`).send({ direction: "up", sessionId: "00000000-0000-0000-0000-000000000013" }).set("Cookie", cookie);
    const res = await request(app).post(`/api/posts/${post.id}/vote`).send({ direction: "down", sessionId: "00000000-0000-0000-0000-000000000013" }).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: -1 });
  });

  it("レスポンスに down 累積数フィールドは含まれない", async () => {
    const postRepo = createInMemoryPostRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);
    const cookie = await loginAndGetCookie(app);

    const res = await request(app)
      .post(`/api/posts/${post.id}/vote`)
      .send({ direction: "down", sessionId: "00000000-0000-0000-0000-000000000014" })
      .set("Cookie", cookie);
    expect(res.body).not.toHaveProperty("downVotes");
    expect(res.body).not.toHaveProperty("downCount");
    expect(res.body).not.toHaveProperty("down_count");
  });

  it("未認証（sessionId のみ）でも post に vote できる（HTTP 200）(#777)", async () => {
    const postRepo = createInMemoryPostRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);
    const res = await request(app)
      .post(`/api/posts/${post.id}/vote`)
      .send({ direction: "up", sessionId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: 1 });
  });

  it("sessionId なしの vote リクエストは 400 を返す (#777)", async () => {
    const postRepo = createInMemoryPostRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);
    const res = await request(app)
      .post(`/api/posts/${post.id}/vote`)
      .send({ direction: "up" });
    expect(res.status).toBe(400);
  });

  it("同一 sessionId × 同一 post で toggle が機能する（未認証）(#777)", async () => {
    const postRepo = createInMemoryPostRepository();
    const voteRepo = createInMemoryVoteRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo, voteRepository: voteRepo });
    const app = createApp(deps);
    const sessionId = "00000000-0000-0000-0000-000000000002";

    await request(app).post(`/api/posts/${post.id}/vote`).send({ direction: "up", sessionId });
    const res = await request(app).post(`/api/posts/${post.id}/vote`).send({ direction: "up", sessionId });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: 0 });
  });

  it("存在しない post は 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const loginRes = await request(app).post("/api/auth/dev-login");
    const cookie = loginRes.headers["set-cookie"] as string[];
    const res = await request(app).post("/api/posts/not-exists/vote").send({ direction: "up", sessionId: "00000000-0000-0000-0000-000000000015" }).set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("vote レスポンスに comment_count が正しく含まれる（#779）", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-2", text: "C1" },
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 1, author: "worker-3", text: "C2" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo, commentRepository: commentRepo });
    const app = createApp(deps);
    const cookie = await loginAndGetCookie(app);

    const res = await request(app)
      .post(`/api/posts/${post.id}/vote`)
      .send({ direction: "up", sessionId: "00000000-0000-0000-0000-000000000016" })
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.comment_count).toBe(2);
  });
});

describe("POST /api/comments/:commentId/vote", () => {
  async function loginAndGetCookie(app: Express.Application) {
    const loginRes = await request(app).post("/api/auth/dev-login");
    return loginRes.headers["set-cookie"] as string[];
  }

  it("direction=up で comment に up vote できる（score +1）", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const [comment] = await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-2", text: "Comment" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo, commentRepository: commentRepo });
    const app = createApp(deps);
    const cookie = await loginAndGetCookie(app);

    const res = await request(app)
      .post(`/api/comments/${comment.id}/vote`)
      .send({ direction: "up", sessionId: "00000000-0000-0000-0000-000000000017" })
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: 1 });
  });

  it("direction=down で comment に down vote できる（score -1）", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const [comment] = await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-2", text: "Comment" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo, commentRepository: commentRepo });
    const app = createApp(deps);
    const cookie = await loginAndGetCookie(app);

    const res = await request(app)
      .post(`/api/comments/${comment.id}/vote`)
      .send({ direction: "down", sessionId: "00000000-0000-0000-0000-000000000018" })
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: -1 });
  });

  it("down 済みに再度 down で toggle off（score 0）", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const voteRepo = createInMemoryVoteRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const [comment] = await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-2", text: "Comment" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo, commentRepository: commentRepo, voteRepository: voteRepo });
    const app = createApp(deps);
    const cookie = await loginAndGetCookie(app);

    await request(app).post(`/api/comments/${comment.id}/vote`).send({ direction: "down", sessionId: "00000000-0000-0000-0000-000000000019" }).set("Cookie", cookie);
    const res = await request(app).post(`/api/comments/${comment.id}/vote`).send({ direction: "down", sessionId: "00000000-0000-0000-0000-000000000019" }).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: 0 });
  });

  it("未認証（sessionId のみ）でも comment に vote できる（HTTP 200）(#777)", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const [comment] = await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-2", text: "Comment" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo, commentRepository: commentRepo });
    const app = createApp(deps);
    const res = await request(app)
      .post(`/api/comments/${comment.id}/vote`)
      .send({ direction: "up", sessionId: "00000000-0000-0000-0000-000000000003" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: 1 });
  });
});

describe("POST /api/posts/:postId/view（閲覧ビーコン・#665）", () => {
  it("有効なリクエストで 202 を返す（認証不要）", async () => {
    const postRepo = createInMemoryPostRepository();
    const viewRepo = createInMemoryViewRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "w1", title: "T", text: "B" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo, viewRepository: viewRepo });
    const app = createApp(deps);

    const res = await request(app)
      .post(`/api/posts/${post.id}/view`)
      .send({ sessionId: "sess-abc" });
    expect(res.status).toBe(202);
  });

  it("sessionId が欠落すると 400 を返す", async () => {
    const postRepo = createInMemoryPostRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "w1", title: "T", text: "B" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app).post(`/api/posts/${post.id}/view`).send({});
    expect(res.status).toBe(400);
  });

  it("存在しない postId には 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);

    const res = await request(app)
      .post("/api/posts/non-existent/view")
      .send({ sessionId: "sess-abc" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/posts/:postId/comment-views（コメント閲覧ビーコン・#665）", () => {
  it("有効なリクエストで 202 を返す（認証不要）", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const viewRepo = createInMemoryViewRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "w1", title: "T", text: "B" },
    ]);
    const [comment] = await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "w2", text: "C" },
    ]);
    const deps = await createTestDeps({
      postRepository: postRepo,
      commentRepository: commentRepo,
      viewRepository: viewRepo,
    });
    const app = createApp(deps);

    const res = await request(app)
      .post(`/api/posts/${post.id}/comment-views`)
      .send({ sessionId: "sess-abc", commentIds: [comment.id] });
    expect(res.status).toBe(202);
  });

  it("sessionId が欠落すると 400 を返す", async () => {
    const postRepo = createInMemoryPostRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "w1", title: "T", text: "B" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app)
      .post(`/api/posts/${post.id}/comment-views`)
      .send({ commentIds: ["c1"] });
    expect(res.status).toBe(400);
  });

  it("commentIds が空配列でも 202 を返す（no-op）", async () => {
    const postRepo = createInMemoryPostRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "w1", title: "T", text: "B" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app)
      .post(`/api/posts/${post.id}/comment-views`)
      .send({ sessionId: "sess-abc", commentIds: [] });
    expect(res.status).toBe(202);
  });

  it("存在しない postId には 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);

    const res = await request(app)
      .post("/api/posts/non-existent/comment-views")
      .send({ sessionId: "sess-abc", commentIds: [] });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/posts/:postId my_vote 付与（#831）", () => {
  it("sessionId を付与すると投票済み post に my_vote が付く", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const voteRepo = createInMemoryVoteRepository();

    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "T", text: "B" },
    ]);
    await voteRepo.vote({ sessionId: "00000000-0000-0000-0000-000000000099", userId: null, targetType: "post", targetId: post.id, direction: "up" });

    const deps = await createTestDeps({ postRepository: postRepo, commentRepository: commentRepo, voteRepository: voteRepo });
    const app = createApp(deps);

    const res = await request(app).get(`/api/posts/${post.id}?sessionId=00000000-0000-0000-0000-000000000099`);
    expect(res.status).toBe(200);
    expect(res.body.post.my_vote).toBe("up");
  });

  it("sessionId を付与すると投票済み comment に my_vote が付く", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const voteRepo = createInMemoryVoteRepository();

    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "T", text: "B" },
    ]);
    const [comment] = await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "s", seq: 0, author: "w2", text: "C" },
    ]);
    await voteRepo.vote({ sessionId: "00000000-0000-0000-0000-000000000099", userId: null, targetType: "comment", targetId: comment.id, direction: "down" });

    const deps = await createTestDeps({ postRepository: postRepo, commentRepository: commentRepo, voteRepository: voteRepo });
    const app = createApp(deps);

    const res = await request(app).get(`/api/posts/${post.id}?sessionId=00000000-0000-0000-0000-000000000099`);
    expect(res.status).toBe(200);
    expect(res.body.comments[0].my_vote).toBe("down");
  });

  it("sessionId 未指定のときは my_vote を含まない（後方互換）", async () => {
    const postRepo = createInMemoryPostRepository();
    const commentRepo = createInMemoryCommentRepository();
    const voteRepo = createInMemoryVoteRepository();

    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "s", seq: 0, author: "w", title: "T", text: "B" },
    ]);
    await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "s", seq: 0, author: "w2", text: "C" },
    ]);

    const deps = await createTestDeps({ postRepository: postRepo, commentRepository: commentRepo, voteRepository: voteRepo });
    const app = createApp(deps);

    const res = await request(app).get(`/api/posts/${post.id}`);
    expect(res.status).toBe(200);
    expect(res.body.post).not.toHaveProperty("my_vote");
    expect(res.body.comments[0]).not.toHaveProperty("my_vote");
  });
});

describe("GET /api/posts/search author_worker 付与（#1058）", () => {
  it("author が解決可能なワーカーのとき、検索結果に author_worker が付与される", async () => {
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "haru", title: "ライドシェアの話", text: "本文" },
    ]);
    const workerRepo = createInMemoryWorkerRepository([
      { id: "uuid-haru", displayName: "haru", role: null, personality: null, imageUrl: "https://example.com/haru.png" },
    ]);

    const deps = await createTestDeps({ postRepository: postRepo, workerRepository: workerRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/posts/search").query({ q: "ライドシェア" });
    expect(res.status).toBe(200);
    expect(res.body[0].author_worker).toEqual({
      id: "uuid-haru",
      display_name: "haru",
      image_url: "https://example.com/haru.png",
    });
  });

  it("author が解決できないとき、author_worker を付与せず author の生文字列のまま返す", async () => {
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "unknown-worker-id", title: "ライドシェアの話2", text: "本文" },
    ]);

    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);

    const res = await request(app).get("/api/posts/search").query({ q: "ライドシェア" });
    expect(res.status).toBe(200);
    expect(res.body[0].author).toBe("unknown-worker-id");
    expect(res.body[0].author_worker).toBeUndefined();
  });
});
