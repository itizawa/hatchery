import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateOpenApiDocument } from "./registry.js";

const doc = generateOpenApiDocument();
const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../openapi.json");
writeFileSync(outPath, JSON.stringify(doc, null, 2), "utf-8");
console.log(`openapi.json を生成しました: ${outPath}`);
