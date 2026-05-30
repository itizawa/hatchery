import { describe, expect, it } from "vitest";

import { SceneSchema } from "./scene.js";

describe("SceneSchema (A-4)", () => {
  it("messages が 1 件以上なら parse 成功する", () => {
    const ok = SceneSchema.parse({
      scene: "朝の始業",
      messages: [{ speaker: "haru", channel: "zatsudan", text: "おはよ〜" }],
    });
    expect(ok.messages).toHaveLength(1);
  });

  it("messages が空配列なら parse に失敗する", () => {
    expect(SceneSchema.safeParse({ scene: "朝の始業", messages: [] }).success).toBe(false);
  });

  it("scene が空文字なら parse に失敗する", () => {
    expect(
      SceneSchema.safeParse({
        scene: "",
        messages: [{ speaker: "haru", channel: "zatsudan", text: "x" }],
      }).success,
    ).toBe(false);
  });

  // A-6: concept.md「出力フォーマット」例の JSON が通過する
  it("concept.md の出力 JSON 例（4 メッセージ）が parse 成功し messages.length === 4", () => {
    const conceptOutput = {
      scene: "朝の始業",
      messages: [
        { speaker: "haru", channel: "zatsudan", text: "おはよ〜、今日ちょっと眠い…雨だしね〜" },
        { speaker: "mei", channel: "zatsudan", text: "おはようございます！☀️ あ、雨ですけど元気です！" },
        {
          speaker: "mei",
          channel: "shigoto",
          text: "勉強会のネタ、わたし図解の作り方とかどうかなって思いました🙌",
        },
        { speaker: "haru", channel: "shigoto", text: "いいね〜。それ mei が一番得意なやつだ" },
      ],
    };
    const parsed = SceneSchema.parse(conceptOutput);
    expect(parsed.messages).toHaveLength(4);
    expect(parsed.messages[0]?.speaker).toBe("haru");
  });
});
