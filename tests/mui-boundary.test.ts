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

describe("アイコン Rounded 規約（#808）— 負ケース: 非 Rounded アイコン import を検出する", () => {
  it("client/src 配下で @mui/icons-material/Home（Filled）はエラー", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/bad-icon.ts",
        `import HomeIcon from "@mui/icons-material/Home";\nexport const x = HomeIcon;\n`,
      ),
    ).toBe(true);
  });

  it("client/src 配下で @mui/icons-material barrel import はエラー", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/bad-icon-barrel.ts",
        `import { Home } from "@mui/icons-material";\nexport const x = Home;\n`,
      ),
    ).toBe(true);
  });
});

describe("アイコン Rounded 規約（#808）— 正ケース: 許可された import は通る", () => {
  it("client/src 配下で @mui/icons-material/HomeRounded はエラーにならない", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/ok-icon.ts",
        `import HomeIcon from "@mui/icons-material/HomeRounded";\nexport const x = HomeIcon;\n`,
      ),
    ).toBe(false);
  });

  it("client/src 配下でブランドアイコン @mui/icons-material/X はエラーにならない（Rounded バリアントなし）", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/ok-brand-icon.ts",
        `import XIcon from "@mui/icons-material/X";\nexport const x = XIcon;\n`,
      ),
    ).toBe(false);
  });

  it("client/src/components/uiParts 内でも @mui/icons-material/HomeRounded はエラーにならない", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/components/uiParts/icons.ts",
        `import HomeIcon from "@mui/icons-material/HomeRounded";\nexport { HomeIcon };\n`,
      ),
    ).toBe(false);
  });

  it("client/src/components/uiParts 内でも非 Rounded アイコンはエラー", async () => {
    expect(
      await hasRestrictedImportError(
        "client/src/components/uiParts/icons.ts",
        `import HomeIcon from "@mui/icons-material/Home";\nexport { HomeIcon };\n`,
      ),
    ).toBe(true);
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
