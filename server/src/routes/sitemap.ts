import { Router } from "express";

import type { CommunityRecord, CommunityRepository } from "../persistence/communityRepository.js";

/** XML 特殊文字をエスケープする（loc に slug 等のユーザ由来文字列を埋めるため）。 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** community の最終更新日時を決める。lastSlotKey（最終投稿スロット）優先、無ければ createdAt。 */
function resolveLastmod(community: CommunityRecord): Date {
  if (community.lastSlotKey) {
    const parsed = new Date(community.lastSlotKey);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return community.createdAt;
}

/** 末尾スラッシュを除いたベース URL を返す（loc 連結時の `//` を防ぐ）。 */
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * GET /sitemap.xml ルータ（#259）。公開ページ（トップ + 全 community）を列挙して
 * クローラーにインデックスを促す。認証不要（公共コミュニティ・ADR-0019/0020）。
 */
export function createSitemapRouter(
  communityRepo: CommunityRepository,
  baseUrl: string,
): Router {
  const router = Router();
  const base = normalizeBaseUrl(baseUrl);

  router.get("/", (_req, res, next) => {
    communityRepo
      .list()
      .then((communities) => {
        const urls: string[] = [`  <url>\n    <loc>${escapeXml(base)}/</loc>\n  </url>`];

        for (const community of communities) {
          const loc = `${escapeXml(base)}/communities/${escapeXml(community.slug)}`;
          const lastmod = resolveLastmod(community).toISOString();
          urls.push(`  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`);
        }

        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          `${urls.join("\n")}\n` +
          `</urlset>\n`;

        res.type("application/xml").status(200).send(xml);
      })
      .catch(next);
  });

  return router;
}
