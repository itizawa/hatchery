import { describe, expect, it } from "vitest";

import { detectWorkerMentions } from "./detectWorkerMentions.js";

describe("detectWorkerMentions", () => {
  it("本文中に含まれる単一のワーカー名を検出する", () => {
    const mentions = detectWorkerMentions({
      text: "今日はケンタが面白い投稿をしていた",
      workers: [{ id: "worker-1", displayName: "ケンタ" }],
    });

    expect(mentions).toEqual([
      { workerId: "worker-1", displayName: "ケンタ", start: 3, end: 6 },
    ]);
  });

  it("複数の異なるワーカー名が重ならない場合はすべて検出する", () => {
    const mentions = detectWorkerMentions({
      text: "アリスとボブが議論している",
      workers: [
        { id: "worker-alice", displayName: "アリス" },
        { id: "worker-bob", displayName: "ボブ" },
      ],
    });

    expect(mentions).toEqual([
      { workerId: "worker-alice", displayName: "アリス", start: 0, end: 3 },
      { workerId: "worker-bob", displayName: "ボブ", start: 4, end: 6 },
    ]);
  });

  it("最長一致優先: 長い表示名に含まれる短い表示名は誤検出せず、独立した短い表示名は検出する", () => {
    const workers = [
      { id: "worker-ken", displayName: "ken" },
      { id: "worker-kenta", displayName: "kenta" },
    ];

    const mentions = detectWorkerMentions({ text: "ken and kenta", workers });

    expect(mentions).toEqual([
      { workerId: "worker-ken", displayName: "ken", start: 0, end: 3 },
      { workerId: "worker-kenta", displayName: "kenta", start: 8, end: 13 },
    ]);
  });

  it("kenta という並びの中の ken は検出されない", () => {
    const workers = [
      { id: "worker-ken", displayName: "ken" },
      { id: "worker-kenta", displayName: "kenta" },
    ];

    const mentions = detectWorkerMentions({ text: "kenta says hi", workers });

    expect(mentions).toEqual([
      { workerId: "worker-kenta", displayName: "kenta", start: 0, end: 5 },
    ]);
  });

  it("表示名が2文字未満のワーカーは検出対象から除外する", () => {
    const mentions = detectWorkerMentions({
      text: "Aiが返信した",
      workers: [{ id: "worker-a", displayName: "A" }],
    });

    expect(mentions).toEqual([]);
  });

  it("一致するワーカー名が無ければ空配列を返す", () => {
    const mentions = detectWorkerMentions({
      text: "誰にも言及していない本文です",
      workers: [{ id: "worker-1", displayName: "ケンタ" }],
    });

    expect(mentions).toEqual([]);
  });

  it("返り値は start の昇順でソートされる", () => {
    const workers = [
      { id: "worker-bob", displayName: "ボブ" },
      { id: "worker-alice", displayName: "アリス" },
    ];

    const mentions = detectWorkerMentions({ text: "アリスとボブ", workers });

    expect(mentions.map((m) => m.workerId)).toEqual(["worker-alice", "worker-bob"]);
  });
});
