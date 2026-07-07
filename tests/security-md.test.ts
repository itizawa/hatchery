import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const securityMdPath = path.join(repoRoot, "SECURITY.md");
const readmePath = path.join(repoRoot, "README.md");

describe("SECURITY.md (Issue #1082)", () => {
  it("リポジトリルートに SECURITY.md が存在する", () => {
    expect(existsSync(securityMdPath)).toBe(true);
  });

  const content = existsSync(securityMdPath) ? readFileSync(securityMdPath, "utf8") : "";

  it("対象範囲として main ブランチ（本番相当）が明記されている", () => {
    expect(content).toMatch(/main/);
  });

  it("GitHub Private vulnerability reporting による報告方法が明記されている", () => {
    expect(content).toMatch(/Private vulnerability reporting/);
    expect(content).toMatch(/Report a vulnerability/);
  });

  it("Public Issue での脆弱性報告を行わないよう明記されている", () => {
    expect(content).toMatch(/Public Issue/);
  });

  it("報告後の対応方針が記載されている", () => {
    expect(content).toMatch(/対応方針/);
  });
});

describe("README.md からの SECURITY.md リンク (Issue #1082)", () => {
  it("「ドキュメント」一覧に SECURITY.md へのリンクがある", () => {
    const readme = readFileSync(readmePath, "utf8");
    const start = readme.indexOf("## ドキュメント");
    expect(start, "'## ドキュメント' セクションが見つからない").not.toBe(-1);
    const end = readme.indexOf("## ", start + 1);
    const section = readme.slice(start, end === -1 ? undefined : end);
    expect(section).toMatch(/\(\.\/SECURITY\.md\)/);
  });
});
