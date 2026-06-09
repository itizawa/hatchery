import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const renovatePath = path.join(repoRoot, "renovate.json");

function readRenovate(): Record<string, unknown> {
  const raw = readFileSync(renovatePath, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

describe("renovate.json の存在 (受け入れ条件 #1)", () => {
  it("renovate.json がリポジトリルートに存在する", () => {
    expect(existsSync(renovatePath)).toBe(true);
  });

  it("有効な JSON としてパースできる", () => {
    expect(() => readRenovate()).not.toThrow();
  });
});

describe("ベースブランチ設定 (受け入れ条件 #4)", () => {
  it("baseBranches が develop を含む", () => {
    const config = readRenovate();
    const bases = config.baseBranches as string[];
    expect(Array.isArray(bases)).toBe(true);
    expect(bases).toContain("develop");
  });

  it("baseBranches に main を含まない（main 直の PR を防ぐ）", () => {
    const config = readRenovate();
    const bases = (config.baseBranches ?? []) as string[];
    expect(bases).not.toContain("main");
  });
});

describe("クールダウン設定 (受け入れ条件 #2)", () => {
  it("minimumReleaseAge が定義されている", () => {
    const config = readRenovate();
    expect(config.minimumReleaseAge).toBeDefined();
  });

  it("minimumReleaseAge が 7 days のクールダウンを設定している", () => {
    const config = readRenovate();
    const age = config.minimumReleaseAge as string;
    expect(age).toMatch(/7\s+days?/);
  });
});

describe("スケジュール設定 (受け入れ条件 #1)", () => {
  it("schedule が定義されている（定期的に PR を生成する）", () => {
    const config = readRenovate();
    expect(config.schedule).toBeDefined();
    const schedule = config.schedule as string[];
    expect(Array.isArray(schedule)).toBe(true);
    expect(schedule.length).toBeGreaterThan(0);
  });
});

describe("セキュリティ例外設定 (受け入れ条件 #3)", () => {
  it("vulnerabilityAlerts が定義されている（重大セキュリティ修正の例外ポリシー）", () => {
    const config = readRenovate();
    expect(config.vulnerabilityAlerts).toBeDefined();
  });

  it("vulnerabilityAlerts の minimumReleaseAge は 0 days（CVE 修正は即時適用）", () => {
    const config = readRenovate();
    const vulnAlerts = config.vulnerabilityAlerts as Record<string, unknown>;
    const age = vulnAlerts?.minimumReleaseAge as string | undefined;
    expect(age).toMatch(/^0\s+days?$/);
  });
});

// --- Issue #149: automerge 運用ポリシー ---

function findPackageRule(
  matchDepTypes: string[],
  matchUpdateTypes: string[],
): Record<string, unknown> | undefined {
  const config = readRenovate();
  const rules = config.packageRules as Record<string, unknown>[];
  return rules?.find((r) => {
    const dt = r.matchDepTypes as string[] | undefined;
    const ut = r.matchUpdateTypes as string[] | undefined;
    return (
      dt != null &&
      ut != null &&
      matchDepTypes.every((t) => dt.includes(t)) &&
      matchUpdateTypes.every((t) => ut.includes(t))
    );
  });
}

describe("automerge ポリシー (受け入れ条件 #1・#2)", () => {
  it("devDependencies の minor/patch ルールに automerge: true が設定されている（CI 緑で自動マージ）", () => {
    const rule = findPackageRule(["devDependencies"], ["minor", "patch"]);
    expect(rule, "devDependencies minor/patch ルールが存在する").toBeDefined();
    expect(rule?.automerge).toBe(true);
  });

  it("devDependencies の minor/patch ルールに automergeType: 'pr' が設定されている（CI チェック必須）", () => {
    const rule = findPackageRule(["devDependencies"], ["minor", "patch"]);
    expect(rule?.automergeType).toBe("pr");
  });

  it("本番 dependencies の minor/patch ルールの automerge は falsy（手動レビュー必須）", () => {
    const rule = findPackageRule(["dependencies"], ["minor", "patch"]);
    expect(rule, "dependencies minor/patch ルールが存在する").toBeDefined();
    expect(rule?.automerge).toBeFalsy();
  });

  it("major 更新ルールに automerge: false が設定されている（破壊的変更は常に手動レビュー）", () => {
    const config = readRenovate();
    const rules = config.packageRules as Record<string, unknown>[];
    const majorRule = rules?.find((r) => {
      const ut = r.matchUpdateTypes as string[] | undefined;
      return ut?.includes("major");
    });
    expect(majorRule, "major ルールが存在する").toBeDefined();
    expect(majorRule?.automerge).toBe(false);
  });
});

describe("PR 溜まり防止設定 (受け入れ条件 #3)", () => {
  it("dependencyDashboard: true が設定されている（未処理 Renovate PR の一覧 Issue を生成）", () => {
    const config = readRenovate();
    expect(config.dependencyDashboard).toBe(true);
  });

  it("prConcurrentLimit が正の数値として設定されている（同時 PR 数の上限）", () => {
    const config = readRenovate();
    expect(config.prConcurrentLimit, "prConcurrentLimit が定義されている").toBeDefined();
    expect(typeof config.prConcurrentLimit).toBe("number");
    expect(config.prConcurrentLimit as number).toBeGreaterThan(0);
  });
});
