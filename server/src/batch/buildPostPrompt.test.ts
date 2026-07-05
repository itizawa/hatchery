import { describe, expect, it } from "vitest";

import type { CommunityRecord } from "../persistence/communityRepository.js";
import { buildPostPrompt, detectConvergentTitlePattern } from "./buildPostPrompt.js";
import type { WorkerDef } from "./buildCommunityPrompt.js";

const community: CommunityRecord = {
  id: "community-1",
  slug: "technology",
  name: "テクノロジー",
  description: "テクノロジーとプログラミングの話題を楽しむコミュニティ。",
  generationInstruction: null,
  feedUrl: null,
  synopsis: null,
  lastSlotKey: null,
  iconUrl: null,
  coverUrl: null,
  createdAt: new Date("2026-01-01"),
};

const workers: WorkerDef[] = [
  { id: "worker-1", displayName: "haru", role: "ムードメーカー" },
  { id: "worker-2", displayName: "ken", role: "ベテラン" },
];

describe("buildPostPrompt", () => {
  it("プロンプトに post 生成指示が含まれる", () => {
    const { prompt } = buildPostPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain("posts");
  });

  it("プロンプトにコメント件数の生成指示が含まれない（コメントは生成しない）", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      countHints: { postCount: 2 },
    });
    expect(prompt).not.toMatch(/コメント.*件/);
    expect(prompt).not.toMatch(/comment.*件/i);
  });

  it("countHints.postCount が指定されたとき、その件数がプロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      countHints: { postCount: 3 },
    });
    expect(prompt).toContain("3");
  });

  it("コミュニティ名・説明がプロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain(community.name);
    expect(prompt).toContain(community.description);
  });

  it("ワーカー ID がプロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain("worker-1");
    expect(prompt).toContain("worker-2");
  });

  it("直近ログが指定された場合プロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: ["2026-01-01 haru: テスト投稿"],
    });
    expect(prompt).toContain("テスト投稿");
  });

  it("comments フィールドは空配列で出力するよう指示する", () => {
    const { prompt } = buildPostPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain('"comments": []');
  });

  it("replies フィールドは空配列で出力するよう指示する", () => {
    const { prompt } = buildPostPrompt({ community, workers, recentLog: [] });
    expect(prompt).toContain('"replies": []');
  });

  it("注意事項に URL を本文に含めない禁止指示が含まれる（#927）", () => {
    const { prompt } = buildPostPrompt({ community, workers, recentLog: [] });
    expect(prompt).toMatch(/URL.*含めない|含めない.*URL/);
  });
});

describe("タイトル重複回避・修辞多様化指示（#1019）", () => {
  it("recentTitles が指定された場合、タイトル重複回避の指示がプロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      recentTitles: ["「努力は報われる」って呑いの言葉じゃない？"],
    });
    expect(prompt).toMatch(/同一.*タイトル.*使わない|タイトル.*重複.*避け|既存タイトル.*使わない/);
  });

  it("recentTitles に含まれる各タイトル文字列がプロンプトに明記される", () => {
    const title1 = "「努力は報われる」って呑いの言葉じゃない？";
    const title2 = "「やりがい」を報酬として使う組織、普通に搭取じゃない？";
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      recentTitles: [title1, title2],
    });
    expect(prompt).toContain(title1);
    expect(prompt).toContain(title2);
  });

  it("recentTitles が空配列のとき、タイトル重複回避の指示がプロンプトに含まれない", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      recentTitles: [],
    });
    expect(prompt).not.toMatch(/同一.*タイトル.*使わない|タイトル.*重複.*避け|既存タイトル.*使わない/);
  });

  it("recentTitles が省略されたとき、タイトル重複回避の指示がプロンプトに含まれない（後方互換）", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
    });
    expect(prompt).not.toMatch(/同一.*タイトル.*使わない|タイトル.*重複.*避け|既存タイトル.*使わない/);
  });

  it("recentTitles が指定された場合、修辞スタイル多様化の指示がプロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      recentTitles: ["「変化を恐れるな」って、変化のコストを誰が払うかを完全に無視してない？"],
    });
    expect(prompt).toMatch(/修辞|スタイル|パターン|文体|切り口/);
  });
});

describe("detectConvergentTitlePattern（#1086）", () => {
  it("「〜って、〜してない／じゃない？」型が過半数を占める場合、パターンラベルを返す", () => {
    const titles = [
      "「変化を恐れるな」って、変化のコストを誰が払うかを完全に無視してない？",
      "「つながりが大事」って言葉、孤独を選んでる人間への攻撃になってない？",
      "「好きなことで生きていける」って、選択肢がある人間の世界観を全員に押しつけてない？",
      "「努力は報われる」って呑いの言葉じゃない？",
    ];
    expect(detectConvergentTitlePattern(titles)).not.toBeNull();
  });

  it("「体言はYか——副題」型が過半数を占める場合、パターンラベルを返す", () => {
    const titles = [
      "「嘘をつく権利」はあるか——誠実義務・自己保護・他者保護のトリレンマ",
      "「正しい目的のための暴力」は正当化されるか——抵抗権・革命倫理・手段と目的の非対称性",
      "「手続きは正しかった」は免罪符になるか——手続き的正義と実質的正義の緊張",
      "「一貫性」はビジネスの正義か——属人的判断と規則適用のスピードトレードオフ",
    ];
    expect(detectConvergentTitlePattern(titles)).not.toBeNull();
  });

  it("タイトルが多様でどのパターンにも過半数収束していない場合 null を返す", () => {
    const titles = [
      "新人研修で配られた資料が5年前のまま更新されていない件",
      "リモートワークで雑談が消えると気づいたこと",
      "「頑張れ」しか言わない上司との一年間",
      "定例会議の半分は要らないと思う理由",
    ];
    expect(detectConvergentTitlePattern(titles)).toBeNull();
  });

  it("サンプル数が閾値未満（4件未満）の場合、全件一致でも null を返す", () => {
    const titles = [
      "「変化を恐れるな」って、変化のコストを誰が払うかを完全に無視してない？",
      "「つながりが大事」って言葉、孤独を選んでる人間への攻撃になってない？",
      "「努力は報われる」って呑いの言葉じゃない？",
    ];
    expect(detectConvergentTitlePattern(titles)).toBeNull();
  });

  it("引用句＋「って」の告発調グルーを伴わない一般的な否定疑問文だけでは収束と判定しない（過検知防止・セルフレビュー指摘#1086）", () => {
    const titles = [
      "新提案、まだ試してない？",
      "この機能ってもう使ってない？",
      "その資料、更新してない？",
      "この件、放置してない？",
    ];
    expect(detectConvergentTitlePattern(titles)).toBeNull();
  });
});

describe("収束パターン検知時の強い警告指示（#1086）", () => {
  const convergentTitles = [
    "「変化を恐れるな」って、変化のコストを誰が払うかを完全に無視してない？",
    "「つながりが大事」って言葉、孤独を選んでる人間への攻撃になってない？",
    "「好きなことで生きていける」って、選択肢がある人間の世界観を全員に押しつけてない？",
    "「努力は報われる」って呑いの言葉じゃない？",
  ];

  const diverseTitles = [
    "新人研修で配られた資料が5年前のまま更新されていない件",
    "リモートワークで雑談が消えると気づいたこと",
    "「頑張れ」しか言わない上司との一年間",
    "定例会議の半分は要らないと思う理由",
  ];

  it("収束パターンが検知された場合、代替文体（断定・体験談・引用・対話形式）を求める警告がプロンプトに含まれる", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      recentTitles: convergentTitles,
    });
    expect(prompt).toMatch(/断定/);
    expect(prompt).toMatch(/体験談/);
    expect(prompt).toMatch(/引用/);
    expect(prompt).toMatch(/対話形式/);
  });

  it("収束パターンが検知されない場合、代替文体を求める警告はプロンプトに含まれない", () => {
    const { prompt } = buildPostPrompt({
      community,
      workers,
      recentLog: [],
      recentTitles: diverseTitles,
    });
    expect(prompt).not.toMatch(/断定/);
    expect(prompt).not.toMatch(/体験談/);
  });
});
