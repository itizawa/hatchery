import { describe, expect, it } from "vitest";

import {
  ChannelSchema,
  CommunitySchema,
  CommentSchema,
  EmployeeSchema,
  GenerationOutputSchema,
  MessageArraySchema,
  MessageSchema,
  PostSchema,
  SubscriptionSchema,
  TaskSchema,
  WorldStateSchema,
} from "./index.js";
import type {
  Channel,
  Community,
  Comment,
  Employee,
  GenerationOutput,
  Message,
  Post,
  Subscription,
  Task,
  WorldState,
} from "./index.js";

describe("@hatchery/common 公開 API", () => {
  it("既存ドメインスキーマが index から再エクスポートされている", () => {
    expect(typeof EmployeeSchema.parse).toBe("function");
    expect(typeof ChannelSchema.parse).toBe("function");
    expect(typeof MessageSchema.parse).toBe("function");
    expect(typeof MessageArraySchema.parse).toBe("function");
    expect(typeof TaskSchema.parse).toBe("function");
  });

  it("新公共コミュニティドメインスキーマが index から再エクスポートされている（ADR-0019・#304）", () => {
    expect(typeof CommunitySchema.parse).toBe("function");
    expect(typeof PostSchema.parse).toBe("function");
    expect(typeof CommentSchema.parse).toBe("function");
    expect(typeof SubscriptionSchema.parse).toBe("function");
    expect(typeof WorldStateSchema.parse).toBe("function");
    expect(typeof GenerationOutputSchema.parse).toBe("function");
  });

  it("MessageArraySchema は 1 件以上の配列を受け付ける", () => {
    const ok = MessageArraySchema.parse([
      { createdEmployeeId: "e1", channel: "zatsudan", text: "hi" },
    ]);
    expect(ok).toHaveLength(1);
  });

  it("MessageArraySchema は空配列を拒否する", () => {
    expect(MessageArraySchema.safeParse([]).success).toBe(false);
  });

  it("z.infer 由来の型に最小オブジェクトを代入できる（型レベルは tsc が担保）", () => {
    const employee: Employee = { id: "haru", displayName: "haru" };
    const channel: Channel = { id: "zatsudan", label: "雑談" };
    const message: Message = { createdEmployeeId: "haru", channel: "zatsudan", text: "やあ" };
    const task: Task = { id: "t1", text: "ロゴ案", status: "new" };
    const community: Community = {
      id: "comm-1",
      slug: "ai-workers",
      name: "AI ワーカー",
      description: "AI の日常",
      created_at: new Date(),
    };
    const post: Post = {
      id: "post-1",
      community_id: "comm-1",
      slot_key: "2026-06-10T09:00:00.000Z",
      seq: 0,
      author: "worker-haru",
      title: "タイトル",
      text: "本文",
      score: 0,
      created_at: new Date(),
    };
    const comment: Comment = {
      id: "comment-1",
      community_id: "comm-1",
      post_id: "post-1",
      slot_key: "2026-06-10T09:00:00.000Z",
      seq: 0,
      author: "worker-ken",
      text: "コメント",
      score: 0,
      created_at: new Date(),
    };
    const subscription: Subscription = {
      user_id: "user-1",
      community_id: "comm-1",
      created_at: new Date(),
    };
    const worldState: WorldState = { summaryVersion: 0, workerStates: {} };
    const generationOutput: GenerationOutput = {
      topic: "テスト",
      posts: [
        {
          id: "post-1",
          author: "worker-haru",
          title: "タイトル",
          text: "本文",
          comments: [],
        },
      ],
    };
    expect([
      employee,
      channel,
      message,
      task,
      community,
      post,
      comment,
      subscription,
      worldState,
      generationOutput,
    ]).toHaveLength(10);
  });
});
