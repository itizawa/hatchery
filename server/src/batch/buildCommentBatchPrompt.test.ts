import { describe, expect, it } from "vitest";

import type { CommunityRecord } from "../persistence/communityRepository.js";
import { buildCommentBatchPrompt, type TargetPostForComment } from "./buildCommentBatchPrompt.js";
import type { WorkerDef } from "./buildCommunityPrompt.js";

const community: CommunityRecord = {
  id: "comm-1",
  name: "テストコミュニティ",
  slug: "test-comm",
  description: "コミュニティの説明",
  generationInstruction: null,
  feedUrl: null,
  synopsis: null,
  createdAt: new Date("2026-01-01"),
};

const workers: WorkerDef[] = [
  {
    id: "worker-uuid-1",
    displayName: "ワーカーA",
    role: "エンジニア",
    personality: null,
    verbosity: null,
  },
  {
    id: "worker-uuid-2",
    displayName: "ワーカーB",
    role: null,
    personality: null,
    verbosity: null,
  },
];

const targetPosts: TargetPostForComment[] = [
  {
    ref: "ref-1",
    id: "post-id-1",
    title: "テスト投稿1",
    text: "投稿本文1",
    commentCount: 2,
    existingComments: [],
  },
  {
    ref: "ref-2",
    id: "post-id-2",
    title: "テスト投稿2",
    text: "投稿本文2",
    commentCount: 3,
    existingComments: [{ author: "worker-uuid-1", text: "既存コメント" }],
  },
];

describe("buildCommentBatchPrompt", () => {
  it("prompt と postRefMap を返す", () => {
    const { prompt, postRefMap } = buildCommentBatchPrompt({
      community,
      workers,
      recentLog: [],
      targetPosts,
    });
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
    expect(postRefMap).toBeInstanceOf(Map);
  });

  it("postRefMap が ref → postId を正しくマッピングする", () => {
    const { postRefMap } = buildCommentBatchPrompt({
      community,
      workers,
      recentLog: [],
      targetPosts,
    });
    expect(postRefMap.get("ref-1")).toBe("post-id-1");
    expect(postRefMap.get("ref-2")).toBe("post-id-2");
    expect(postRefMap.size).toBe(2);
  });

  it("プロンプトにコミュニティ名が含まれる", () => {
    const { prompt } = buildCommentBatchPrompt({
      community,
      workers,
      recentLog: [],
      targetPosts,
    });
    expect(prompt).toContain("テストコミュニティ");
  });

  it("プロンプトにワーカー UUID が含まれる", () => {
    const { prompt } = buildCommentBatchPrompt({
      community,
      workers,
      recentLog: [],
      targetPosts,
    });
    expect(prompt).toContain("worker-uuid-1");
    expect(prompt).toContain("worker-uuid-2");
  });

  it("プロンプトに対象 post の ref と title が含まれる", () => {
    const { prompt } = buildCommentBatchPrompt({
      community,
      workers,
      recentLog: [],
      targetPosts,
    });
    expect(prompt).toContain("ref-1");
    expect(prompt).toContain("ref-2");
    expect(prompt).toContain("テスト投稿1");
    expect(prompt).toContain("テスト投稿2");
  });

  it("プロンプトにコメント件数ヒントが含まれる", () => {
    const { prompt } = buildCommentBatchPrompt({
      community,
      workers,
      recentLog: [],
      targetPosts,
    });
    expect(prompt).toContain("2");
    expect(prompt).toContain("3");
  });

  it("コミュニティの作風が含まれる", () => {
    const { prompt } = buildCommentBatchPrompt({
      community,
      workers,
      recentLog: [],
      targetPosts,
    });
    expect(prompt).toContain("コミュニティの説明");
  });

  it("recentLog がプロンプトに含まれる", () => {
    const { prompt } = buildCommentBatchPrompt({
      community,
      workers,
      recentLog: ["最近の投稿1", "最近の投稿2"],
      targetPosts,
    });
    expect(prompt).toContain("最近の投稿1");
  });

  it("targetPosts が空の場合でも prompt を返す", () => {
    const { prompt, postRefMap } = buildCommentBatchPrompt({
      community,
      workers,
      recentLog: [],
      targetPosts: [],
    });
    expect(typeof prompt).toBe("string");
    expect(postRefMap.size).toBe(0);
  });

  it("synopsis があればプロンプトに含まれる", () => {
    const communityWithSynopsis: CommunityRecord = {
      ...community,
      synopsis: "コミュニティのあらすじ",
    };
    const { prompt } = buildCommentBatchPrompt({
      community: communityWithSynopsis,
      workers,
      recentLog: [],
      targetPosts,
    });
    expect(prompt).toContain("コミュニティのあらすじ");
  });
});
