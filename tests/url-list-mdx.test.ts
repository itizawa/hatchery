import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(repoRoot, "docs", "src");
const wrapperPath = path.join(srcDir, "url-list.mdx");

function read(p: string): string {
  return readFileSync(p, "utf8");
}

/** docs/src 直下の *.mdx ファイル名一覧。 */
function srcMdxFiles(): string[] {
  return readdirSync(srcDir).filter((f) => f.endsWith(".mdx"));
}

describe("docs/src/url-list.mdx（受け入れ条件 #200: MDX ラッパー）", () => {
  it("ファイルが存在する", () => {
    expect(existsSync(wrapperPath), "docs/src/url-list.mdx が存在する").toBe(true);
  });

  it("正本 docs/design/url-list.md を ?raw でインポートする薄いラッパーである", () => {
    const body = read(wrapperPath);
    expect(
      body,
      "url-list.md を ?raw でインポートしている",
    ).toMatch(/url-list\.md\?raw/);
  });

  it("Storybook に取り込まれる <Meta title=...> を持つ", () => {
    const body = read(wrapperPath);
    expect(body, "<Meta title=...> を持つ").toMatch(/<Meta\s+title=/);
  });
});

describe("scene MDX の url-list リンク切れ解消（受け入れ条件 #200: AC5）", () => {
  it("docs/src/*.mdx に壊れた相対リンク (./url-list.md) が残っていない", () => {
    for (const file of srcMdxFiles()) {
      const body = read(path.join(srcDir, file));
      expect(
        body,
        `${file} に壊れた相対リンク (./url-list.md) が無い`,
      ).not.toMatch(/\]\(\.\/url-list\.md\)/);
    }
  });

  it("url-list を参照する scene MDX は正本パス docs/design/url-list.md を含む形で参照する", () => {
    const referencing = srcMdxFiles().filter((f) =>
      /url-list/.test(read(path.join(srcDir, f))),
    );
    // ラッパー自身を除いた、url-list へ言及する scene MDX
    const scenes = referencing.filter((f) => f !== "url-list.mdx");
    expect(scenes.length, "url-list を参照する scene MDX が 1 件以上ある").toBeGreaterThan(0);
    for (const file of scenes) {
      const body = read(path.join(srcDir, file));
      expect(
        body,
        `${file} が正本パス docs/design/url-list.md を明示している`,
      ).toContain("docs/design/url-list.md");
    }
  });
});

describe("home-feed-scene.mdx の認証要否が router と矛盾しない（受け入れ条件 #200: AC5/補足）", () => {
  it("URL 表で / を『必須』と記載していない（router は beforeLoad なし＝ゲスト可）", () => {
    const body = read(path.join(srcDir, "home-feed-scene.mdx"));
    const urlTableRows = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("| `/`") || l.startsWith("|`/`"));
    expect(urlTableRows.length, "/ の URL 表行が存在する").toBeGreaterThan(0);
    for (const row of urlTableRows) {
      expect(row, `/ の行で『必須』と記載しない: ${row}`).not.toContain("必須");
    }
  });
});
