import { describe, expect, it } from "vitest";

import { buildOpenApiDocument } from "./generate.js";

// generate.ts は OpenAPI ドキュメント生成スクリプトの入口（#468）。
// import 時に writeFileSync / console.log の副作用が走らないこと（buildOpenApiDocument は
// 純粋関数で、ファイル書き込みはテスト対象外）を前提に、生成ドキュメントの妥当性を検証する。
describe("buildOpenApiDocument", () => {
  it("openapi フィールドが 3.x 系である（受け入れ条件 2）", () => {
    const doc = buildOpenApiDocument();
    expect(typeof doc.openapi).toBe("string");
    expect(doc.openapi).toMatch(/^3\./);
  });

  it("info（title）を持つ（受け入れ条件 2）", () => {
    const doc = buildOpenApiDocument();
    expect(doc.info).toBeDefined();
    expect(typeof doc.info.title).toBe("string");
    expect(doc.info.title.length).toBeGreaterThan(0);
  });

  it("代表的なエンドポイント /api/feed が paths に含まれる（受け入れ条件 3）", () => {
    const doc = buildOpenApiDocument();
    expect(doc.paths).toHaveProperty("/api/feed");
  });

  it("代表的なエンドポイント /api/communities が paths に含まれる（受け入れ条件 3）", () => {
    const doc = buildOpenApiDocument();
    expect(doc.paths).toHaveProperty("/api/communities");
  });
});
