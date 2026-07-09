import { describe, expect, it } from "vitest";

import { detectSimilarRecentPost } from "./detectDuplicatePostText.js";

describe("detectSimilarRecentPost（#1115）", () => {
  it("候補テキストが直近 post 本文と完全一致する場合、一致した post を返す", () => {
    const text = "「やりがい」を報酬として使う組織、普通に搾取じゃない？という話。";
    const result = detectSimilarRecentPost({
      candidateText: text,
      recentPosts: [{ title: "既存投稿", text }],
    });

    expect(result).not.toBeNull();
    expect(result?.matchedTitle).toBe("既存投稿");
    expect(result?.similarity).toBe(1);
  });

  it("候補テキストが直近 post 本文とごくわずかな差異（空白1文字）しかない場合も高類似度として検知する", () => {
    const original =
      "「失敗から学べ」って、失敗した人へのバッシングの免罪符になってない？押し付ける構造じゃない？";
    const candidate =
      "「失敗から学べ」って、失敗した人へのバッシングの免罪符になってない？ 押し付ける構造じゃない？";

    const result = detectSimilarRecentPost({
      candidateText: candidate,
      recentPosts: [{ title: "既存投稿2", text: original }],
    });

    expect(result).not.toBeNull();
    expect(result?.matchedTitle).toBe("既存投稿2");
    expect(result?.similarity).toBeGreaterThanOrEqual(0.8);
  });

  it("明らかに異なるテキストでは null を返す（誤検知しない）", () => {
    const result = detectSimilarRecentPost({
      candidateText: "リモートワークで雑談が消えると気づいたこと。在宅勤務3年目の実感。",
      recentPosts: [
        { title: "既存投稿3", text: "新人研修で配られた資料が5年前のまま更新されていない件について。" },
      ],
    });

    expect(result).toBeNull();
  });

  it("直近 post が複数ある場合、最も類似度が高い候補を返す", () => {
    const candidate = "「やりがい」を報酬として使う組織、普通に搾取じゃない？という話。";
    const result = detectSimilarRecentPost({
      candidateText: candidate,
      recentPosts: [
        { title: "無関係な投稿", text: "今日は天気がいいのでカフェで作業した。" },
        { title: "ほぼ同一の投稿", text: candidate },
      ],
    });

    expect(result?.matchedTitle).toBe("ほぼ同一の投稿");
    expect(result?.similarity).toBe(1);
  });

  it("直近 post が空配列のとき null を返す", () => {
    const result = detectSimilarRecentPost({
      candidateText: "何らかの投稿本文。",
      recentPosts: [],
    });

    expect(result).toBeNull();
  });
});
