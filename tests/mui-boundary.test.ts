import path from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RESTRICTED_IMPORTS_RULE_ID = "no-restricted-imports";

let eslint: ESLint;
beforeAll(() => {
  eslint = new ESLint({ cwd: repoRoot });
});

async function hasRestrictedImportError(relPath: string, code: string): Promise<boolean> {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(repoRoot, relPath),
  });
  return result.messages.some((m) => m.ruleId === RESTRICTED_IMPORTS_RULE_ID);
}

describe("MUI 腐敗防止層 — 負ケース: 直接 import を ESLint が検出する", () => {
  it("client/src 配下で @mui/material/* 直接 import はエラー", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/bad.ts",
        `import Box from "@mui/material/Box";\nexport const x = Box;\n`,
      ),
    ).toBe(true);
  });

  it("client/src 配下でバレルパス @mui/material 直接 import はエラー", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/bad2.ts",
        `import { Box } from "@mui/material";\nexport const x = Box;\n`,
      ),
    ).toBe(true);
  });
});

describe("MUI 腐敗防止層 — 正ケース: 許可されたファイルは通る", () => {
  it("client/src/components/uiParts/ 内は @mui/material/* 直接 import が許可", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/components/uiParts/index.ts",
        `import Box from "@mui/material/Box";\nexport { Box };\n`,
      ),
    ).toBe(false);
  });

  it("client/src/theme.ts は @mui/material/styles の import が許可", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/theme.ts",
        `import { createTheme } from "@mui/material/styles";\nexport const t = createTheme({});\n`,
      ),
    ).toBe(false);
  });

  it("client/src/AppRoot.tsx は CssBaseline / ThemeProvider の import が許可", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/AppRoot.tsx",
        `import CssBaseline from "@mui/material/CssBaseline";\nimport { ThemeProvider } from "@mui/material/styles";\nexport {};\n`,
      ),
    ).toBe(false);
  });

  it("client/src 配下で uiParts 経由 import はエラーにならない", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/components/SomeComponent.tsx",
        `import { Box } from "./uiParts";\nexport const x = Box;\n`,
      ),
    ).toBe(false);
  });
});

describe("MUI 腐敗防止層 — 例外ファイルでも @hatchery/server は禁止のまま", () => {
  it("uiParts 内でも @hatchery/server import はエラー", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/components/uiParts/index.ts",
        `import { something } from "@hatchery/server";\nexport {};\n`,
      ),
    ).toBe(true);
  });

  it("client/src/theme.ts でも @hatchery/server import はエラー", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/theme.ts",
        `import { something } from "@hatchery/server";\nexport {};\n`,
      ),
    ).toBe(true);
  });
});
