import { describe, expect, it } from "vitest";

import { createInMemoryCommunityRepository } from "../persistence/communityRepository.js";
import { createInMemoryPostRepository } from "../persistence/postRepository.js";

import { runBackfillNewsPostUrls } from "./backfillNewsPostUrls.js";

// runBackfillNewsPostUrls は永続化層の CommunityRepository / PostRepository に依存するため、
// 既存の createInMemoryCommunityRepository / createInMemoryPostRepository を注入して
// DB 接続なしでテストする（#1117・#1057 と同じパターン）。

const makeCommunity = (overrides: Partial<Parameters<typeof createInMemoryCommunityRepository>[0][0]> = {}) => ({
  id: "community-news",
  slug: "news",
  name: "ニュース",
  description: "ニュースコミュニティ",
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  generationInstruction: null,
  feedUrl: null,
  createdAt: new Date("2026-01-01"),
  ...overrides,
});

describe("runBackfillNewsPostUrls (#1117)", () => {
  it("本文冒頭にURLが露出した post から URL 行のみを除去する", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const [created] = await postRepo.createMany("community-news", [
      {
        slotKey: "s",
        seq: 0,
        author: "worker-1",
        title: "「週休3日制」導入企業じわじわ増加",
        text: "https://b.hatena.ne.jp/hotentry/general\n\n「週休3日制」導入企業じわじわ増加——でも実態は「給与も3割減」なケースが多い問題",
      },
    ]);

    const result = await runBackfillNewsPostUrls({ communityRepository: communityRepo, postRepository: postRepo });

    expect(result).toEqual({ updatedCount: 1, updatedIds: [created.id] });
    const found = await postRepo.findById(created.id);
    expect(found?.text).toBe(
      "「週休3日制」導入企業じわじわ増加——でも実態は「給与も3割減」なケースが多い問題",
    );
    expect(found?.title).toBe("「週休3日制」導入企業じわじわ増加"); // 意味内容（タイトル）は変更しない
  });

  it("タイトル末尾にURLが露出した post から ' / URL' のみを除去する", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const [created] = await postRepo.createMany("community-news", [
      {
        slotKey: "s",
        seq: 0,
        author: "worker-1",
        title:
          "ライドシェア解禁の議論、またループしてるけど今回こそ本気でやる気あるの？ / https://b.hatena.ne.jp/hotentry/general",
        text: "本文はそのまま。",
      },
    ]);

    const result = await runBackfillNewsPostUrls({ communityRepository: communityRepo, postRepository: postRepo });

    expect(result).toEqual({ updatedCount: 1, updatedIds: [created.id] });
    const found = await postRepo.findById(created.id);
    expect(found?.title).toBe(
      "ライドシェア解禁の議論、またループしてるけど今回こそ本気でやる気あるの？",
    );
    expect(found?.text).toBe("本文はそのまま。"); // 意味内容（本文）は変更しない
  });

  it("本文・タイトル両方に露出がある post も両方まとめて更新する", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    const [created] = await postRepo.createMany("community-news", [
      {
        slotKey: "s",
        seq: 0,
        author: "worker-1",
        title: "タイトル / https://b.hatena.ne.jp/hotentry/general",
        text: "https://b.hatena.ne.jp/hotentry/general\n\n本文の要約",
      },
    ]);

    const result = await runBackfillNewsPostUrls({ communityRepository: communityRepo, postRepository: postRepo });

    expect(result).toEqual({ updatedCount: 1, updatedIds: [created.id] });
    const found = await postRepo.findById(created.id);
    expect(found?.title).toBe("タイトル");
    expect(found?.text).toBe("本文の要約");
  });

  it("URL露出が無い post は更新対象に含めない", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-news", [
      { slotKey: "s", seq: 0, author: "worker-1", title: "普通のタイトル", text: "普通の本文" },
    ]);

    const result = await runBackfillNewsPostUrls({ communityRepository: communityRepo, postRepository: postRepo });

    expect(result).toEqual({ updatedCount: 0, updatedIds: [] });
  });

  it("news 以外のコミュニティの post は対象に含めない", async () => {
    const communityRepo = createInMemoryCommunityRepository([
      makeCommunity(),
      makeCommunity({ id: "community-tech", slug: "tech", name: "テック" }),
    ]);
    const postRepo = createInMemoryPostRepository();
    await postRepo.createMany("community-tech", [
      {
        slotKey: "s",
        seq: 0,
        author: "worker-1",
        title: "テックのタイトル",
        text: "https://b.hatena.ne.jp/hotentry/general\n\nテックの本文",
      },
    ]);

    const result = await runBackfillNewsPostUrls({ communityRepository: communityRepo, postRepository: postRepo });

    expect(result).toEqual({ updatedCount: 0, updatedIds: [] });
  });

  it("news コミュニティ自体が存在しない場合は空の結果を返す", async () => {
    const communityRepo = createInMemoryCommunityRepository([]);
    const postRepo = createInMemoryPostRepository();

    const result = await runBackfillNewsPostUrls({ communityRepository: communityRepo, postRepository: postRepo });

    expect(result).toEqual({ updatedCount: 0, updatedIds: [] });
  });

  it("対象が0件のとき空の結果を返す", async () => {
    const communityRepo = createInMemoryCommunityRepository([makeCommunity()]);
    const postRepo = createInMemoryPostRepository();

    const result = await runBackfillNewsPostUrls({ communityRepository: communityRepo, postRepository: postRepo });

    expect(result).toEqual({ updatedCount: 0, updatedIds: [] });
  });
});
