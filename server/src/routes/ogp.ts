import { OgpUrlQuerySchema, extractOgpFromHtml } from "@hatchery/common";
import { Router } from "express";

/**
 * プライベート IP・localhost・リンクローカル等の SSRF リスクホストにマッチする正規表現群（#515）。
 * DNS 解決をせず、URL のホスト文字列レベルで弾く。
 */
const SSRF_BLOCKED_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^\[::1\]$/,
];

/** OGP 取得のタイムアウト（ミリ秒）。 */
const FETCH_TIMEOUT_MS = 5000;
/** OGP 取得のレスポンス最大サイズ（バイト）。 */
const MAX_RESPONSE_BYTES = 512 * 1024; // 512KB

/**
 * ホスト文字列が SSRF リスクパターンに該当するかを判定する（#515）。
 * IP アドレスまたは localhost に対してのみチェックする（一般的なドメイン名は通す）。
 */
function isSsrfBlockedHost(hostname: string): boolean {
  return SSRF_BLOCKED_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * OGP 取得プロキシ。GET /api/ogp?url=<url>（#515）。
 * - url クエリパラメータを OgpUrlQuerySchema で検証
 * - SSRF ガード: プライベート IP / localhost を拒否
 * - 対象 URL の HTML を fetch（タイムアウト 5s・最大 512KB）
 * - og:title / description / image / site_name を抽出して返す
 * - 取得失敗・非 HTML・OGP 無しの場合は null フィールドで 200 を返す
 */
export function createOgpRouter(): Router {
  const router = Router();

  // eslint-disable-next-line max-params
  router.get("/", async (req, res) => {
    // クエリパラメータ検証
    const parsed = OgpUrlQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", issues: parsed.error.issues });
      return;
    }

    const { url } = parsed.data;

    // SSRF ガード
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      res.status(400).json({ error: "InvalidUrl" });
      return;
    }

    if (isSsrfBlockedHost(hostname)) {
      res.status(400).json({ error: "SsrfBlocked" });
      return;
    }

    // OGP 取得
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let fetchResponse: Response;
      try {
        fetchResponse = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Hatchery-OGP-Fetcher/1.0",
            Accept: "text/html,application/xhtml+xml",
          },
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // Content-Type が text/html でなければ OGP 無しを返す
      const contentType = fetchResponse.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        res.status(200).json({ title: null, description: null, image: null, site_name: null });
        return;
      }

      // レスポンスサイズ上限チェック（text() の前に Content-Length ヘッダーを確認）
      const contentLength = Number(fetchResponse.headers.get("content-length") ?? 0);
      if (contentLength > MAX_RESPONSE_BYTES) {
        res.status(200).json({ title: null, description: null, image: null, site_name: null });
        return;
      }

      const html = await fetchResponse.text();
      // 実際の取得サイズも確認（Content-Length が省略されている場合のフォールバック）
      if (Buffer.byteLength(html, "utf-8") > MAX_RESPONSE_BYTES) {
        res.status(200).json({ title: null, description: null, image: null, site_name: null });
        return;
      }

      const ogp = extractOgpFromHtml(html);
      res.status(200).json(ogp);
    } catch {
      // フェッチ失敗・タイムアウト等はエラーにせず OGP 無しを返す
      res.status(200).json({ title: null, description: null, image: null, site_name: null });
    }
  });

  return router;
}
