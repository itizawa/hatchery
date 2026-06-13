import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cfBeaconHtmlPlugin } from "./vite.config";

/**
 * transformIndexHtml フックを直接呼んで HTML 出力を得るヘルパー。
 * Vite プラグインの transformIndexHtml は関数（または { handler } オブジェクト）形式。
 */
function runTransform(html: string): string {
  const plugin = cfBeaconHtmlPlugin();
  const hook = plugin.transformIndexHtml;
  if (typeof hook === "function") {
    return hook(html, {} as never) as string;
  }
  if (hook && typeof hook === "object" && typeof hook.handler === "function") {
    return hook.handler(html, {} as never) as string;
  }
  throw new Error("transformIndexHtml フックが関数として取得できない");
}

const PLACEHOLDER = "%VITE_CF_BEACON_TOKEN_SCRIPT%";
const TEMPLATE = `<head>\n  ${PLACEHOLDER}\n</head>`;

describe("cfBeaconHtmlPlugin（Cloudflare Web Analytics ビーコンの env→HTML 注入）", () => {
  const original = process.env.VITE_CF_BEACON_TOKEN;

  beforeEach(() => {
    delete process.env.VITE_CF_BEACON_TOKEN;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.VITE_CF_BEACON_TOKEN;
    else process.env.VITE_CF_BEACON_TOKEN = original;
  });

  // 受け入れ条件 #1: トークン設定時は token 入りのビーコン script を出力する。
  it("VITE_CF_BEACON_TOKEN が設定されているとき beacon script を token 入りで出力する", () => {
    process.env.VITE_CF_BEACON_TOKEN = "abc123token";
    const out = runTransform(TEMPLATE);
    expect(out).toContain('src="https://static.cloudflareinsights.com/beacon.min.js"');
    expect(out).toContain("data-cf-beacon=");
    expect(out).toContain('"token":"abc123token"');
    expect(out).toContain("defer");
    // プレースホルダが残らない。
    expect(out).not.toContain(PLACEHOLDER);
  });

  // 受け入れ条件 #1: トークン未設定時は beacon script を一切出力しない。
  it("VITE_CF_BEACON_TOKEN が未設定のとき beacon script を出力しない", () => {
    delete process.env.VITE_CF_BEACON_TOKEN;
    const out = runTransform(TEMPLATE);
    expect(out).not.toContain("beacon.min.js");
    expect(out).not.toContain("data-cf-beacon");
    expect(out).not.toContain("<script");
    // プレースホルダも残らない（空に置換する）。
    expect(out).not.toContain(PLACEHOLDER);
  });

  // 空文字・空白のみのトークンも未設定扱いにする（壊れた空 token タグを残さない）。
  it("VITE_CF_BEACON_TOKEN が空白のみのとき beacon script を出力しない", () => {
    process.env.VITE_CF_BEACON_TOKEN = "   ";
    const out = runTransform(TEMPLATE);
    expect(out).not.toContain("beacon.min.js");
    expect(out).not.toContain(PLACEHOLDER);
  });

  // トークンに " や \ が含まれても JSON が壊れないようエスケープして埋め込む。
  it("トークンに特殊文字が含まれても JSON として安全にエスケープされる", () => {
    process.env.VITE_CF_BEACON_TOKEN = 'a"b\\c';
    const out = runTransform(TEMPLATE);
    // data-cf-beacon の属性値は単一引用符で囲み、内部の JSON は二重引用符。
    // JSON.stringify により " は \" に、\ は \\ にエスケープされる。
    expect(out).toContain('{"token":"a\\"b\\\\c"}');
  });
});
