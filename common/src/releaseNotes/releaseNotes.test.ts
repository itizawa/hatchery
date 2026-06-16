import { describe, expect, it } from "vitest";
import {
  ReleaseNotesSummarySchema,
  buildReleaseNotesPrompt,
  renderReleaseNotesMarkdown,
} from "./releaseNotes.js";

// ── ReleaseNotesSummarySchema ───────────────────────────────────

describe("ReleaseNotesSummarySchema", () => {
  it("正常な入力を受け付ける", () => {
    const input = {
      overview: "v1.3.0 では新機能Aと修正Bを含むリリースです。",
      features: ["新機能Aを追加"],
      improvements: [],
      fixes: ["修正B"],
      others: [],
    };
    const result = ReleaseNotesSummarySchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("overview が空文字のとき reject される", () => {
    const input = {
      overview: "",
      features: [],
      improvements: [],
      fixes: [],
      others: [],
    };
    const result = ReleaseNotesSummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("overview が max(500)を超えるとき reject される", () => {
    const input = {
      overview: "a".repeat(501),
      features: [],
      improvements: [],
      fixes: [],
      others: [],
    };
    const result = ReleaseNotesSummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("overview が max(500) ちょうどは通る", () => {
    const input = {
      overview: "a".repeat(500),
      features: [],
      improvements: [],
      fixes: [],
      others: [],
    };
    const result = ReleaseNotesSummarySchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("features の要素が max(200)を超えるとき reject される", () => {
    const input = {
      overview: "概要",
      features: ["a".repeat(201)],
      improvements: [],
      fixes: [],
      others: [],
    };
    const result = ReleaseNotesSummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("improvements の要素が max(200)を超えるとき reject される", () => {
    const input = {
      overview: "概要",
      features: [],
      improvements: ["b".repeat(201)],
      fixes: [],
      others: [],
    };
    const result = ReleaseNotesSummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("fixes の要素が max(200)を超えるとき reject される", () => {
    const input = {
      overview: "概要",
      features: [],
      improvements: [],
      fixes: ["c".repeat(201)],
      others: [],
    };
    const result = ReleaseNotesSummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("others の要素が max(200)を超えるとき reject される", () => {
    const input = {
      overview: "概要",
      features: [],
      improvements: [],
      fixes: [],
      others: ["d".repeat(201)],
    };
    const result = ReleaseNotesSummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("カテゴリ配列が省略されたとき空配列として扱われる", () => {
    const input = { overview: "概要" };
    const result = ReleaseNotesSummarySchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.features).toEqual([]);
      expect(result.data.improvements).toEqual([]);
      expect(result.data.fixes).toEqual([]);
      expect(result.data.others).toEqual([]);
    }
  });
});

// ── buildReleaseNotesPrompt ─────────────────────────────────────

describe("buildReleaseNotesPrompt", () => {
  const version = "v1.3.0";
  const commitLines = [
    "- feat: 新機能Aを追加 (abc1234)",
    "- fix: バグBを修正 (def5678)",
  ];

  it("version 文字列を含む", () => {
    const prompt = buildReleaseNotesPrompt(version, commitLines);
    expect(prompt).toContain("v1.3.0");
  });

  it("commit 行を含む", () => {
    const prompt = buildReleaseNotesPrompt(version, commitLines);
    expect(prompt).toContain("feat: 新機能Aを追加 (abc1234)");
    expect(prompt).toContain("fix: バグBを修正 (def5678)");
  });

  it("JSON 出力指示を含む", () => {
    const prompt = buildReleaseNotesPrompt(version, commitLines);
    expect(prompt.toLowerCase()).toContain("json");
  });

  it("overview フィールドへの言及がある", () => {
    const prompt = buildReleaseNotesPrompt(version, commitLines);
    expect(prompt).toContain("overview");
  });

  it("空のコミット一覧でもプロンプトを生成できる", () => {
    const prompt = buildReleaseNotesPrompt(version, []);
    expect(prompt).toContain("v1.3.0");
  });
});

// ── renderReleaseNotesMarkdown ──────────────────────────────────

describe("renderReleaseNotesMarkdown", () => {
  it("overview を概要セクションに描画する", () => {
    const summary = ReleaseNotesSummarySchema.parse({
      overview: "このリリースは全体的な改善を含みます。",
      features: [],
      improvements: [],
      fixes: [],
      others: [],
    });
    const md = renderReleaseNotesMarkdown(summary);
    expect(md).toContain("## 概要");
    expect(md).toContain("このリリースは全体的な改善を含みます。");
  });

  it("features がある場合 ✨ 新機能 セクションを出力する", () => {
    const summary = ReleaseNotesSummarySchema.parse({
      overview: "概要",
      features: ["新機能Aを追加"],
      improvements: [],
      fixes: [],
      others: [],
    });
    const md = renderReleaseNotesMarkdown(summary);
    expect(md).toContain("### ✨ 新機能");
    expect(md).toContain("- 新機能Aを追加");
  });

  it("improvements がある場合 🛠 改善 セクションを出力する", () => {
    const summary = ReleaseNotesSummarySchema.parse({
      overview: "概要",
      features: [],
      improvements: ["パフォーマンス改善"],
      fixes: [],
      others: [],
    });
    const md = renderReleaseNotesMarkdown(summary);
    expect(md).toContain("### 🛠 改善");
    expect(md).toContain("- パフォーマンス改善");
  });

  it("fixes がある場合 🐛 修正 セクションを出力する", () => {
    const summary = ReleaseNotesSummarySchema.parse({
      overview: "概要",
      features: [],
      improvements: [],
      fixes: ["ログイン不具合を修正"],
      others: [],
    });
    const md = renderReleaseNotesMarkdown(summary);
    expect(md).toContain("### 🐛 修正");
    expect(md).toContain("- ログイン不具合を修正");
  });

  it("others がある場合 🔧 その他 セクションを出力する", () => {
    const summary = ReleaseNotesSummarySchema.parse({
      overview: "概要",
      features: [],
      improvements: [],
      fixes: [],
      others: ["依存関係を更新"],
    });
    const md = renderReleaseNotesMarkdown(summary);
    expect(md).toContain("### 🔧 その他");
    expect(md).toContain("- 依存関係を更新");
  });

  it("空カテゴリは見出しごと省略する", () => {
    const summary = ReleaseNotesSummarySchema.parse({
      overview: "概要",
      features: ["新機能"],
      improvements: [],
      fixes: [],
      others: [],
    });
    const md = renderReleaseNotesMarkdown(summary);
    expect(md).not.toContain("🛠 改善");
    expect(md).not.toContain("🐛 修正");
    expect(md).not.toContain("🔧 その他");
  });

  it("全カテゴリが空でも overview セクションのみ出力する", () => {
    const summary = ReleaseNotesSummarySchema.parse({
      overview: "小さな修正のみです。",
    });
    const md = renderReleaseNotesMarkdown(summary);
    expect(md).toContain("## 概要");
    expect(md).toContain("小さな修正のみです。");
    expect(md).not.toContain("###");
  });

  it("複数カテゴリを正しい順序で描画する", () => {
    const summary = ReleaseNotesSummarySchema.parse({
      overview: "概要",
      features: ["新機能"],
      improvements: ["改善"],
      fixes: ["修正"],
      others: ["その他"],
    });
    const md = renderReleaseNotesMarkdown(summary);
    const featurePos = md.indexOf("✨ 新機能");
    const improvPos = md.indexOf("🛠 改善");
    const fixPos = md.indexOf("🐛 修正");
    const otherPos = md.indexOf("🔧 その他");
    expect(featurePos).toBeLessThan(improvPos);
    expect(improvPos).toBeLessThan(fixPos);
    expect(fixPos).toBeLessThan(otherPos);
  });
});
