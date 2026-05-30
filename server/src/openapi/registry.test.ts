import { describe, expect, it } from "vitest";

import { generateOpenApiDocument } from "./registry.js";

describe("generateOpenApiDocument", () => {
  it("OpenAPI 3.1 ドキュメントを返す", () => {
    const doc = generateOpenApiDocument();
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBeDefined();
  });

  it("paths に /messages が含まれる", () => {
    const doc = generateOpenApiDocument();
    expect(doc.paths).toHaveProperty("/messages");
  });

  it("components.schemas に Message が含まれる", () => {
    const doc = generateOpenApiDocument();
    expect(doc.components?.schemas).toHaveProperty("Message");
  });
});
