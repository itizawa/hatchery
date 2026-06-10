import { describe, expect, it } from "vitest";

import {
  CommunitySchema,
  CommentSchema,
  GenerationOutputSchema,
  PostSchema,
  SubscriptionSchema,
  WorkerSchema,
  WorldStateSchema,
} from "./index.js";
import type {
  Community,
  Comment,
  GenerationOutput,
  Post,
  Subscription,
  Worker,
  WorldState,
} from "./index.js";

describe("@hatchery/common 公開 API", () => {
  it("公共コミュニティドメインスキーマが index から再エクスポートされている（ADR-0019）", () => {
    expect(typeof CommunitySchema.parse).toBe("function");
    expect(typeof PostSchema.parse).toBe("function");
    expect(typeof CommentSchema.parse).toBe("function");
    expect(typeof SubscriptionSchema.parse).toBe("function");
    expect(typeof WorldStateSchema.parse).toBe("function");
    expect(typeof GenerationOutputSchema.parse).toBe("function");
    expect(typeof WorkerSchema.parse).toBe("function");
  });

  it("z.infer 由来の型に最小オブジェクトを代入できる（型レベルは tsc が担保）", () => {
    const worker: Worker = { id: "haru", displayName: "haru", isBot: true };
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
    expect([worker, community, post, comment, subscription, worldState, generationOutput]).toHaveLength(7);
  });
});
