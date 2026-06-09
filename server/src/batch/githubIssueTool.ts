import type { Octokit } from "@octokit/rest";

/**
 * 1 run（1 チャンネルの query 実行）で起票できる Issue 数の上限（#285 / ADR-0017 (e)）。
 * エージェントの自由起票に委ねず、ツール側でこの上限を強制する。
 */
export const MAX_ISSUES_PER_RUN = 3;

/** 起票の依頼内容。 */
export interface CreateIssueInput {
  title: string;
  body: string;
  /** 提案理由（チャンネルメッセージの proposalReason に使う・任意）。 */
  reason?: string;
}

/** 起票結果。created のときのみ番号/URL を持つ。 */
export type CreateIssueResult =
  | { status: "created"; issueNumber: number; issueUrl: string }
  | { status: "duplicate" }
  | { status: "limit_reached" };

/** 起票ラッパーを生成する依存。 */
export interface GithubIssueCreatorConfig {
  octokit: Octokit;
  owner: string;
  repo: string;
}

/** タイトル正規化（前後空白除去 + 小文字化）。重複判定に使う。 */
function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/**
 * GitHub Issue 起票ラッパーを生成する（#285 / ADR-0017 (e)）。
 *
 * 戻り値の関数は 1 run（クロージャ単位）で以下を強制する:
 * - 重複防止: 既存 open Issue のタイトル（正規化一致）および本 run で起票済みのタイトルと重複しない。
 * - 1 run 最大 N 件: MAX_ISSUES_PER_RUN を超えたら起票しない。
 * - ラベル/マイルストーン方針: df:todo を含む状態ラベル・マイルストーンを一切付与しない
 *   （CLAUDE.md の状態管理方針: 状態ラベル無し・マイルストーン無しで人間トリアージ待ちにする）。
 *
 * 既存 open Issue の一覧は初回呼び出し時に 1 度だけ取得し、以降は本 run の起票分を加味する。
 */
export function createGithubIssueCreator(
  config: GithubIssueCreatorConfig,
): (input: CreateIssueInput) => Promise<CreateIssueResult> {
  const { octokit, owner, repo } = config;

  // 本 run で「起票済み or 既存と重複」とみなしたタイトル（正規化済み）の集合。
  const seenTitles = new Set<string>();
  let createdCount = 0;
  let existingLoaded = false;

  async function ensureExistingLoaded(): Promise<void> {
    if (existingLoaded) return;
    existingLoaded = true;
    try {
      const { data } = await octokit.issues.listForRepo({ owner, repo, state: "open", per_page: 100 });
      for (const issue of data) {
        if (typeof issue.title === "string") {
          seenTitles.add(normalizeTitle(issue.title));
        }
      }
    } catch (err) {
      // 既存一覧の取得失敗時は重複チェックを諦め、本 run の起票分のみで重複防止する。
      console.warn("[githubIssueTool] 既存 Issue 一覧の取得に失敗しました:", err instanceof Error ? err.message : String(err));
    }
  }

  return async function createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
    if (createdCount >= MAX_ISSUES_PER_RUN) {
      return { status: "limit_reached" };
    }

    await ensureExistingLoaded();

    const key = normalizeTitle(input.title);
    if (seenTitles.has(key)) {
      return { status: "duplicate" };
    }

    const { data } = await octokit.issues.create({
      owner,
      repo,
      title: input.title,
      body: input.body,
      // labels / milestone は意図的に渡さない（df:todo 廃止・マイルストーン無し）。
    });

    seenTitles.add(key);
    createdCount += 1;

    return { status: "created", issueNumber: data.number, issueUrl: data.html_url };
  };
}
