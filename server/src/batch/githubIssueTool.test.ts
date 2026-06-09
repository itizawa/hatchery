import { describe, expect, it, vi } from "vitest";

import { createGithubIssueCreator, MAX_ISSUES_PER_RUN } from "./githubIssueTool.js";

/** Octokit.issues の最小スタブを作るヘルパ。 */
function makeOctokitStub(existingTitles: string[] = []) {
  let nextNumber = 100;
  const create = vi.fn().mockImplementation(({ title }: { title: string }) =>
    Promise.resolve({
      data: { number: nextNumber++, html_url: `https://example.test/issues/${title}` },
    }),
  );
  const listForRepo = vi.fn().mockResolvedValue({
    data: existingTitles.map((title, i) => ({ number: i + 1, title })),
  });
  return { issues: { create, listForRepo } };
}

describe("createGithubIssueCreator: 起票ラッパー（#285）", () => {
  const baseConfig = { owner: "itizawa", repo: "hatchery" };

  it("起票時に labels / milestone を渡さない（df:todo を付けない・マイルストーン無し）", async () => {
    const octokit = makeOctokitStub();
    const creator = createGithubIssueCreator({ octokit: octokit as never, ...baseConfig });

    const res = await creator({ title: "改善提案A", body: "本文" });

    expect(res.status).toBe("created");
    expect(res.issueNumber).toBe(100);
    expect(octokit.issues.create).toHaveBeenCalledTimes(1);
    const arg = octokit.issues.create.mock.calls[0][0];
    expect(arg).toMatchObject({ owner: "itizawa", repo: "hatchery", title: "改善提案A", body: "本文" });
    expect(arg.labels).toBeUndefined();
    expect(arg.milestone).toBeUndefined();
  });

  it("既存 open Issue と正規化一致するタイトルは重複起票しない（duplicate）", async () => {
    const octokit = makeOctokitStub(["  改善提案A  "]);
    const creator = createGithubIssueCreator({ octokit: octokit as never, ...baseConfig });

    const res = await creator({ title: "改善提案A", body: "本文" });

    expect(res.status).toBe("duplicate");
    expect(octokit.issues.create).not.toHaveBeenCalled();
  });

  it("同一 run 内で同じタイトルを 2 回起票しようとしても 1 件だけ起票する", async () => {
    const octokit = makeOctokitStub();
    const creator = createGithubIssueCreator({ octokit: octokit as never, ...baseConfig });

    const first = await creator({ title: "重複提案", body: "本文1" });
    const second = await creator({ title: "重複提案", body: "本文2" });

    expect(first.status).toBe("created");
    expect(second.status).toBe("duplicate");
    expect(octokit.issues.create).toHaveBeenCalledTimes(1);
  });

  it("1 run で MAX_ISSUES_PER_RUN を超えると起票せず limit_reached を返す", async () => {
    const octokit = makeOctokitStub();
    const creator = createGithubIssueCreator({ octokit: octokit as never, ...baseConfig });

    for (let i = 0; i < MAX_ISSUES_PER_RUN; i++) {
      const ok = await creator({ title: `提案${i}`, body: "本文" });
      expect(ok.status).toBe("created");
    }
    const over = await creator({ title: "超過提案", body: "本文" });

    expect(over.status).toBe("limit_reached");
    expect(octokit.issues.create).toHaveBeenCalledTimes(MAX_ISSUES_PER_RUN);
  });
});
