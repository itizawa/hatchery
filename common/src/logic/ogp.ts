import type { OgpMeta } from "../domain/ogp/ogp.js";

/**
 * テキストから先頭の http(s):// URL を抽出する純粋関数（#515）。
 * URL が見つからない場合は null を返す。
 * - URL は空白文字で区切られる前提
 * - クエリパラメータ・フラグメントを含む
 */
export function extractFirstUrl(text: string): string | null {
  // http(s):// で始まり、空白・日本語・制御文字以外が続くパターン
  const urlRegex = /https?:\/\/\S+/g;
  const matches = text.match(urlRegex);
  if (!matches || matches.length === 0) {
    return null;
  }
  // 末尾の句読点・括弧類を除去（URL の後に句点や括弧が続く場合）
  const url = matches[0].replace(/[。、.,!?!?）)）\]】]+$/, "");
  return url || null;
}

/**
 * HTML 文字列から OGP メタデータを抽出する純粋関数（#515）。
 * - og:title / og:description / og:image / og:site_name を抽出
 * - og:title が無ければ <title> タグにフォールバック
 * - 見つからない場合は null
 */
export function extractOgpFromHtml(html: string): OgpMeta {
  const title = extractOgProperty(html, "og:title") ?? extractTitle(html) ?? null;
  const description = extractOgProperty(html, "og:description") ?? null;
  const image = extractOgProperty(html, "og:image") ?? null;
  const site_name = extractOgProperty(html, "og:site_name") ?? null;

  return { title, description, image, site_name };
}

/**
 * HTML から指定の og: property を持つ <meta> タグの content を抽出する。
 * property 属性と content 属性の順序を問わない（両順序に対応）。
 */
function extractOgProperty(html: string, property: string): string | undefined {
  // <meta property="og:xxx" content="..." /> のパターン（属性順序不問・ダブル/シングルクォート対応）
  // property が先のパターン
  const propertyFirst = new RegExp(
    `<meta[^>]*\\bproperty=["']${escapeRegex(property)}["'][^>]*\\bcontent=["']([^"']*)["'][^>]*>`,
    "i",
  );
  // content が先のパターン
  const contentFirst = new RegExp(
    `<meta[^>]*\\bcontent=["']([^"']*)["'][^>]*\\bproperty=["']${escapeRegex(property)}["'][^>]*>`,
    "i",
  );

  const matchPropertyFirst = html.match(propertyFirst);
  if (matchPropertyFirst) {
    return matchPropertyFirst[1];
  }
  const matchContentFirst = html.match(contentFirst);
  if (matchContentFirst) {
    return matchContentFirst[1];
  }
  return undefined;
}

/** HTML の <title> タグ内テキストを抽出する。 */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (!match) return undefined;
  const text = match[1];
  return text != null ? text.trim() : undefined;
}

/** 正規表現の特殊文字をエスケープする。 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
