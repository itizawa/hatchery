import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { createInMemoryCommentRepository } from "../persistence/commentRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";
import { createInMemoryVoteRepository } from "../persistence/voteRepository.js";
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

  it("存在しない post は 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const res = await request(app).get("/api/posts/not-exists");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/posts/:postId/vote", () => {
  async function loginAndGetCookie(app: Express.Application) {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
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
      .send({ direction: "up" })
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
      .send({ direction: "down" })
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

    await request(app).post(`/api/posts/${post.id}/vote`).send({ direction: "up" }).set("Cookie", cookie);
    const res = await request(app).post(`/api/posts/${post.id}/vote`).send({ direction: "up" }).set("Cookie", cookie);
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

    await request(app).post(`/api/posts/${post.id}/vote`).send({ direction: "up" }).set("Cookie", cookie);
    const res = await request(app).post(`/api/posts/${post.id}/vote`).send({ direction: "down" }).set("Cookie", cookie);
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
      .send({ direction: "down" })
      .set("Cookie", cookie);
    expect(res.body).not.toHaveProperty("downVotes");
    expect(res.body).not.toHaveProperty("downCount");
    expect(res.body).not.toHaveProperty("down_count");
  });

  it("未認証では 401 を返す", async () => {
    const postRepo = createInMemoryPostRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);
    const res = await request(app).post(`/api/posts/${post.id}/vote`).send({ direction: "up" });
    expect(res.status).toBe(401);
  });

  it("存在しない post は 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);
    const loginRes = await request(app).post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
    const cookie = loginRes.headers["set-cookie"] as string[];
    const res = await request(app).post("/api/posts/not-exists/vote").send({ direction: "up" }).set("Cookie", cookie);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/comments/:commentId/vote", () => {
  async function loginAndGetCookie(app: Express.Application) {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
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
      .send({ direction: "up" })
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
      .send({ direction: "down" })
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

    await request(app).post(`/api/comments/${comment.id}/vote`).send({ direction: "down" }).set("Cookie", cookie);
    const res = await request(app).post(`/api/comments/${comment.id}/vote`).send({ direction: "down" }).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: 0 });
  });
});
