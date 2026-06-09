import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryCommentRepository } from "../persistence/commentRepository.js";
import { InMemoryPostRepository } from "../persistence/postRepository.js";
import { InMemoryVoteRepository } from "../persistence/voteRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";

describe("GET /api/posts/:postId", () => {
  it("post + comments のスレッドを取得できる（認証不要）", async () => {
    const postRepo = new InMemoryPostRepository();
    const commentRepo = new InMemoryCommentRepository();

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
  it("認証済みユーザーが post に up vote できる", async () => {
    const postRepo = new InMemoryPostRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);

    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .post(`/api/posts/${post.id}/vote`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: 1 });
  });

  it("二重投票は 409 を返す", async () => {
    const postRepo = new InMemoryPostRepository();
    const voteRepo = new InMemoryVoteRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);

    const deps = await createTestDeps({
      postRepository: postRepo,
      voteRepository: voteRepo,
    });
    const app = createApp(deps);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
    const cookie = loginRes.headers["set-cookie"] as string[];

    // 1回目 vote
    await request(app)
      .post(`/api/posts/${post.id}/vote`)
      .set("Cookie", cookie);

    // 2回目 vote（二重投票）
    const res = await request(app)
      .post(`/api/posts/${post.id}/vote`)
      .set("Cookie", cookie);
    expect(res.status).toBe(409);
  });

  it("未認証では 401 を返す", async () => {
    const postRepo = new InMemoryPostRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const deps = await createTestDeps({ postRepository: postRepo });
    const app = createApp(deps);
    const res = await request(app).post(`/api/posts/${post.id}/vote`);
    expect(res.status).toBe(401);
  });

  it("存在しない post は 404 を返す", async () => {
    const deps = await createTestDeps();
    const app = createApp(deps);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .post("/api/posts/not-exists/vote")
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/comments/:commentId/vote", () => {
  it("認証済みユーザーが comment に up vote できる", async () => {
    const postRepo = new InMemoryPostRepository();
    const commentRepo = new InMemoryCommentRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const [comment] = await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-2", text: "Comment" },
    ]);

    const deps = await createTestDeps({
      postRepository: postRepo,
      commentRepository: commentRepo,
    });
    const app = createApp(deps);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
    const cookie = loginRes.headers["set-cookie"] as string[];

    const res = await request(app)
      .post(`/api/comments/${comment.id}/vote`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: 1 });
  });

  it("二重投票は 409 を返す", async () => {
    const postRepo = new InMemoryPostRepository();
    const commentRepo = new InMemoryCommentRepository();
    const voteRepo = new InMemoryVoteRepository();
    const [post] = await postRepo.createMany("community-1", [
      { slotKey: "2026-06-10T09:00", seq: 0, author: "worker-1", title: "Title", text: "Text" },
    ]);
    const [comment] = await commentRepo.createMany("community-1", [
      { postId: post.id, slotKey: "2026-06-10T09:00", seq: 0, author: "worker-2", text: "Comment" },
    ]);

    const deps = await createTestDeps({
      postRepository: postRepo,
      commentRepository: commentRepo,
      voteRepository: voteRepo,
    });
    const app = createApp(deps);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ loginId: "testuser", password: "testpass" });
    const cookie = loginRes.headers["set-cookie"] as string[];

    await request(app)
      .post(`/api/comments/${comment.id}/vote`)
      .set("Cookie", cookie);

    const res = await request(app)
      .post(`/api/comments/${comment.id}/vote`)
      .set("Cookie", cookie);
    expect(res.status).toBe(409);
  });
});
