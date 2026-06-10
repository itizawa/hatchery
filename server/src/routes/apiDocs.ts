import { Router } from "express";

import { generateOpenApiDocument } from "../openapi/registry.js";

/**
 * API ドキュメント配信（#106）が有効かどうかを判定する。
 *
 * - `ENABLE_API_DOCS` が "true" / "1" → 有効。
 * - `ENABLE_API_DOCS` が "false" / "0" → 無効。
 * - 未設定 → `NODE_ENV !== "production"`（dev）のときのみ有効。
 *   本番（production）は仕様の不要な外部公開を避けるため既定で無効。
 */
export function isApiDocsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.ENABLE_API_DOCS?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return env.NODE_ENV !== "production";
}

/** Redoc を CDN から読み込み `/openapi.json` を描画する自己完結 HTML。 */
const REDOC_HTML = `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>Hatchery API ドキュメント</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <redoc spec-url="/openapi.json"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>
`;

/**
 * 生成済み OpenAPI（registry を単一情報源）を閲覧するためのルーター（#106 / ADR-0006）。
 *
 * - `GET /openapi.json` … `generateOpenApiDocument()` で都度生成した OpenAPI の生 JSON。
 *   手書きの仕様定義は持たず、Zod スキーマ → registry の生成ロジックをそのまま配信する。
 * - `GET /api-docs` … 上記 JSON を読み込む Redoc の HTML ページ。
 *
 * 配信可否のトグル（`isApiDocsEnabled`）は呼び出し側（app.ts）が判定し、有効時のみ配線する。
 */
export function createApiDocsRouter(): Router {
  const router = Router();

  router.get("/openapi.json", (_req, res) => {
    res.status(200).json(generateOpenApiDocument());
  });

  router.get("/api-docs", (_req, res) => {
    // Redoc は CDN スクリプト・inline スタイル・blob ワーカーを使うため、このルートのみ CSP を緩和する。
    // 他の API ルートには影響しない（後から res.setHeader で上書きされるため）。
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src https://cdn.redoc.ly; style-src 'unsafe-inline'; worker-src blob:; connect-src 'self'; img-src data: blob: https:",
    );
    res.status(200).type("html").send(REDOC_HTML);
  });

  return router;
}
