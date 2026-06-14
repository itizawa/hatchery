/**
 * GitHub Actions の各 action が Node.js 24 対応バージョンを使っているかを検証する。
 * (#465: Node.js 20 廃止対応)
 *
 * Node.js 20 ランナーで動く旧バージョンが残っていないことを確認する。
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsDir = path.join(repoRoot, ".github", "workflows");

function readAllWorkflowFiles(): Record<string, string> {
  const files = readdirSync(workflowsDir).filter((f) => f.endsWith(".yml"));
  return Object.fromEntries(
    files.map((f) => [f, readFileSync(path.join(workflowsDir, f), "utf8")]),
  );
}

/** ワークフローファイル全体から `uses: <action>@<version>` を抽出する。 */
function extractUsesLines(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("uses:"))
    .map((line) => line.replace(/^uses:\s*/, "").trim());
}

describe("GitHub Actions Node.js 24 対応 (#465)", () => {
  const workflows = readAllWorkflowFiles();
  const allUsesLines = Object.entries(workflows).flatMap(([file, content]) =>
    extractUsesLines(content).map((uses) => ({ file, uses })),
  );

  describe("Node.js 20 ベースの旧バージョンが残っていないこと", () => {
    it("actions/checkout@v4 が残っていない", () => {
      const found = allUsesLines.filter((l) => l.uses === "actions/checkout@v4");
      expect(found, `残存ファイル: ${found.map((l) => l.file).join(", ")}`).toHaveLength(0);
    });

    it("actions/setup-node@v4 が残っていない", () => {
      const found = allUsesLines.filter((l) => l.uses === "actions/setup-node@v4");
      expect(found, `残存ファイル: ${found.map((l) => l.file).join(", ")}`).toHaveLength(0);
    });

    it("pnpm/action-setup@v4 が残っていない", () => {
      const found = allUsesLines.filter((l) => l.uses === "pnpm/action-setup@v4");
      expect(found, `残存ファイル: ${found.map((l) => l.file).join(", ")}`).toHaveLength(0);
    });

    it("google-github-actions/auth@v2 が残っていない", () => {
      const found = allUsesLines.filter((l) => l.uses === "google-github-actions/auth@v2");
      expect(found, `残存ファイル: ${found.map((l) => l.file).join(", ")}`).toHaveLength(0);
    });

    it("google-github-actions/setup-gcloud@v2 が残っていない", () => {
      const found = allUsesLines.filter(
        (l) => l.uses === "google-github-actions/setup-gcloud@v2",
      );
      expect(found, `残存ファイル: ${found.map((l) => l.file).join(", ")}`).toHaveLength(0);
    });

    it("actions/upload-artifact@v4 が残っていない", () => {
      const found = allUsesLines.filter((l) => l.uses === "actions/upload-artifact@v4");
      expect(found, `残存ファイル: ${found.map((l) => l.file).join(", ")}`).toHaveLength(0);
    });
  });

  describe("Node.js 24 対応バージョンが使われていること", () => {
    it("actions/checkout@v5 が使われている", () => {
      const found = allUsesLines.filter((l) => l.uses === "actions/checkout@v5");
      expect(found.length, "actions/checkout@v5 が1箇所以上使われている").toBeGreaterThan(0);
    });

    it("actions/setup-node@v5 が使われている", () => {
      const found = allUsesLines.filter((l) => l.uses === "actions/setup-node@v5");
      expect(found.length, "actions/setup-node@v5 が1箇所以上使われている").toBeGreaterThan(0);
    });

    it("pnpm/action-setup@v6 が使われている", () => {
      const found = allUsesLines.filter((l) => l.uses === "pnpm/action-setup@v6");
      expect(found.length, "pnpm/action-setup@v6 が1箇所以上使われている").toBeGreaterThan(0);
    });

    it("google-github-actions/auth@v3 が使われている", () => {
      const found = allUsesLines.filter((l) => l.uses === "google-github-actions/auth@v3");
      expect(
        found.length,
        "google-github-actions/auth@v3 が1箇所以上使われている",
      ).toBeGreaterThan(0);
    });

    it("google-github-actions/setup-gcloud@v3 が使われている", () => {
      const found = allUsesLines.filter(
        (l) => l.uses === "google-github-actions/setup-gcloud@v3",
      );
      expect(
        found.length,
        "google-github-actions/setup-gcloud@v3 が1箇所以上使われている",
      ).toBeGreaterThan(0);
    });

    it("actions/upload-artifact@v6 が使われている", () => {
      const found = allUsesLines.filter((l) => l.uses === "actions/upload-artifact@v6");
      expect(
        found.length,
        "actions/upload-artifact@v6 が1箇所以上使われている",
      ).toBeGreaterThan(0);
    });
  });

  describe("全ワークフローの YAML が妥当であること", () => {
    for (const [file, content] of Object.entries(workflows)) {
      it(`${file} が YAML として妥当である`, () => {
        expect(() => yaml.load(content)).not.toThrow();
        const wf = yaml.load(content);
        expect(wf).toBeTypeOf("object");
        expect(wf).not.toBeNull();
      });
    }
  });
});
