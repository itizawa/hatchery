import { load } from "cheerio";

/** フィードから取得した記事情報（#491 / ADR-0035）。 */
export interface FeedArticle {
  title: string;
  url: string;
  summary: string | null;
  author: string | null;
}

/**
 * 外部フィード記事セクションをプロンプト用テキストとして構築する（#491 / #1104 / ADR-0035）。
 * `buildCommunityPrompt` / `buildPostPrompt` で共有する。
 * URL はプロンプトに含めない（#927: AIが本文にURLをコピーする問題を防ぐ）。
 * feedArticles が空・未指定の場合は空文字を返す（セクション省略）。
 */
export function buildFeedArticlesSection(
  feedArticles: readonly FeedArticle[] | undefined,
): string {
  if (!feedArticles || feedArticles.length === 0) return "";
  return `最新フィード記事（${feedArticles.length}件）:\n${feedArticles
    .map((a) => {
      const authorPart = a.author ? `（by ${a.author}）` : "";
      const summaryPart = a.summary
        ? `\n  概要: ${a.summary.replace(/https?:\/\/\S+/g, "").trim()}`
        : "";
      return `- 「${a.title}」${authorPart}${summaryPart}`;
    })
    .join("\n")}\n（↑ これらの記事を題材に会話を生成してください）\n\n`;
}

/** デフォルトの最大取得件数。 */
const DEFAULT_MAX_ARTICLES = 6;

/** デフォルトのタイムアウト（ms）。 */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * RSS 2.0 / Atom フィードを取得して FeedArticle[] を返す（#491 / ADR-0035）。
 *
 * 外部 HTTP は fetcher 経由で実行するため、テストでモック可能。
 * タイムアウト・HTTP エラー・パース失敗はすべて空配列を返す（エラーは throw しない）。
 */
export async function fetchExternalFeed({
  feedUrl,
  fetcher = globalThis.fetch,
  maxArticles = DEFAULT_MAX_ARTICLES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  feedUrl: string;
  fetcher?: typeof fetch;
  maxArticles?: number;
  timeoutMs?: number;
}): Promise<FeedArticle[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(feedUrl, { signal: controller.signal });
    if (!response.ok) return [];
    const xml = await response.text();
    return parseXml({ xml, maxArticles });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function parseXml({ xml, maxArticles }: { xml: string; maxArticles: number }): FeedArticle[] {
  try {
    const $ = load(xml, { xmlMode: true });

    const rssItems = $("item");
    if (rssItems.length > 0) {
      return parseRssItems({ $, items: rssItems, maxArticles });
    }

    const atomEntries = $("entry");
    if (atomEntries.length > 0) {
      return parseAtomEntries({ $, entries: atomEntries, maxArticles });
    }

    return [];
  } catch {
    return [];
  }
}

function parseRssItems({
  $,
  items,
  maxArticles,
}: {
  $: ReturnType<typeof load>;
  items: ReturnType<ReturnType<typeof load>>;
  maxArticles: number;
}): FeedArticle[] {
  const result: FeedArticle[] = [];

  // eslint-disable-next-line max-params
  items.each((_i, el) => {
    if (result.length >= maxArticles) return false;

    const item = $(el);
    const title = item.find("title").first().text().trim();
    const url = item.find("link").first().text().trim();
    if (!title || !url) return;

    const rawSummary = item.find("description").first().text().trim();
    const summary = rawSummary ? stripHtml(rawSummary) : null;

    const dcCreator = item.find("dc\\:creator").first().text().trim();
    const authorTag = item.find("author").first().text().trim();
    const rawAuthor = dcCreator || authorTag || null;
    const author = rawAuthor ? cleanAuthor(rawAuthor) : null;

    result.push({ title, url, summary, author });
  });

  return result;
}

function parseAtomEntries({
  $,
  entries,
  maxArticles,
}: {
  $: ReturnType<typeof load>;
  entries: ReturnType<ReturnType<typeof load>>;
  maxArticles: number;
}): FeedArticle[] {
  const result: FeedArticle[] = [];

  // eslint-disable-next-line max-params
  entries.each((_i, el) => {
    if (result.length >= maxArticles) return false;

    const entry = $(el);
    const title = entry.find("title").first().text().trim();
    const url = entry.find("link").first().attr("href")?.trim() ?? "";
    if (!title || !url) return;

    const rawSummary = entry.find("summary").first().text().trim();
    const summary = rawSummary ? rawSummary : null;

    const authorName = entry.find("author name").first().text().trim();
    const author = authorName || null;

    result.push({ title, url, summary, author });
  });

  return result;
}

function stripHtml(html: string): string {
  const $ = load(html, { xmlMode: false });
  return $.text().trim();
}

function cleanAuthor(raw: string): string {
  // RSS <author> は "email (名前)" 形式が多いので名前部分を抽出
  const match = /\(([^)]+)\)/.exec(raw);
  return match?.[1]?.trim() ?? raw.trim();
}
