import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ReleaseNotesGenerator, runGenerateReleaseNotes } from "./generateReleaseNotes.js";

// テスト対象の純粋なロジック関数を直接テストする。
// main() はプロセスに依存するため、ロジック層 runGenerateReleaseNotes を切り出してテストする。

describe("runGenerateReleaseNotes", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("正常系: AI が正常な JSON を返すとき markdown 文字列を返す", async () => {
    const validJson = JSON.stringify({
      overview: "v1.3.0 は重要な修正と改善を含みます。",
      features: ["新機能Aを追加"],
      improvements: ["パフォーマンスを改善"],
      fixes: ["ログイン不具合を修正"],
      others: [],
    });

    const mockGenerator: ReleaseNotesGenerator = vi.fn().mockResolvedValue(validJson);

    const result = await runGenerateReleaseNotes({
      version: "v1.3.0",
      commitLines: ["- feat: 新機能A (abc1234)", "- fix: ログイン不具合修正 (def5678)"],
      apiKey: "test-api-key",
      generator: mockGenerator,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.markdown).toContain("## 概要");
      expect(result.markdown).toContain("v1.3.0 は重要な修正と改善を含みます。");
      expect(result.markdown).toContain("### ✨ 新機能");
      expect(result.markdown).toContain("- 新機能Aを追加");
      expect(result.markdown).toContain("### 🐛 修正");
      expect(result.markdown).toContain("- ログイン不具合を修正");
    }
  });

  it("正常系: generator が呼ばれるとき version と commitLines を含むプロンプトが渡る", async () => {
    const validJson = JSON.stringify({ overview: "概要", features: [], improvements: [], fixes: [], others: [] });
    const mockGenerator: ReleaseNotesGenerator = vi.fn().mockResolvedValue(validJson);

    await runGenerateReleaseNotes({
      version: "v2.0.0",
      commitLines: ["- feat: 重大な新機能 (aaa0001)"],
      apiKey: "key",
      generator: mockGenerator,
    });

    expect(mockGenerator).toHaveBeenCalledOnce();
    const [prompt, apiKey] = (mockGenerator as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(prompt).toContain("v2.0.0");
    expect(prompt).toContain("feat: 重大な新機能 (aaa0001)");
    expect(apiKey).toBe("key");
  });

  it("異常系: AI が不正な JSON を返すとき failure を返す", async () => {
    const mockGenerator: ReleaseNotesGenerator = vi.fn().mockResolvedValue("これはJSONではありません");

    const result = await runGenerateReleaseNotes({
      version: "v1.0.0",
      commitLines: [],
      apiKey: "key",
      generator: mockGenerator,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it("異常系: AI が Zod スキーマ不一致の JSON を返すとき failure を返す", async () => {
    // overview フィールドが欠落している
    const invalidSchema = JSON.stringify({ features: ["新機能"] });
    const mockGenerator: ReleaseNotesGenerator = vi.fn().mockResolvedValue(invalidSchema);

    const result = await runGenerateReleaseNotes({
      version: "v1.0.0",
      commitLines: [],
      apiKey: "key",
      generator: mockGenerator,
    });

    expect(result.success).toBe(false);
  });

  it("異常系: AI が max() 超過の値を返すとき failure を返す", async () => {
    // overview が 501 文字（max 500 を超過）
    const overflowJson = JSON.stringify({
      overview: "a".repeat(501),
      features: [],
      improvements: [],
      fixes: [],
      others: [],
    });
    const mockGenerator: ReleaseNotesGenerator = vi.fn().mockResolvedValue(overflowJson);

    const result = await runGenerateReleaseNotes({
      version: "v1.0.0",
      commitLines: [],
      apiKey: "key",
      generator: mockGenerator,
    });

    expect(result.success).toBe(false);
  });

  it("異常系: generator が例外をスローするとき failure を返す", async () => {
    const mockGenerator: ReleaseNotesGenerator = vi.fn().mockRejectedValue(new Error("API エラー"));

    const result = await runGenerateReleaseNotes({
      version: "v1.0.0",
      commitLines: [],
      apiKey: "key",
      generator: mockGenerator,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("API エラー");
    }
  });

  it("正常系: overview のみで features/improvements/fixes/others が全て空のとき ### セクションを出力しない", async () => {
    const validJson = JSON.stringify({
      overview: "小さな内部リファクタのみのリリース。",
      features: [],
      improvements: [],
      fixes: [],
      others: [],
    });
    const mockGenerator: ReleaseNotesGenerator = vi.fn().mockResolvedValue(validJson);

    const result = await runGenerateReleaseNotes({
      version: "v1.0.1",
      commitLines: ["- refactor: 内部整理 (xxx0001)"],
      apiKey: "key",
      generator: mockGenerator,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.markdown).not.toContain("###");
    }
  });

  it("正常系: AI がコードブロック内 JSON（```json ... ```）を返してもパースできる", async () => {
    const jsonContent = JSON.stringify({
      overview: "概要テスト。",
      features: ["機能A"],
      improvements: [],
      fixes: [],
      others: [],
    });
    // AI がコードブロックで返した場合を模擬
    const codeBlockJson = `\`\`\`json\n${jsonContent}\n\`\`\``;
    const mockGenerator: ReleaseNotesGenerator = vi.fn().mockResolvedValue(codeBlockJson);

    const result = await runGenerateReleaseNotes({
      version: "v1.0.0",
      commitLines: [],
      apiKey: "key",
      generator: mockGenerator,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.markdown).toContain("概要テスト。");
    }
  });
});
