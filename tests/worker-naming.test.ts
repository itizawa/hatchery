/**
 * Issue #329: Employee → Worker リネーム規約テスト
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readFile(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

function dirExists(rel: string): boolean {
  return existsSync(path.join(repoRoot, rel));
}

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripComments(code: string): string {
  let stripped = code.replace(/\/\*[\s\S]*?\*\//g, "");
  stripped = stripped.replace(/\/\/[^\n]*/g, "");
  return stripped;
}

describe("Issue #329: Worker ディレクトリ構造の確認", () => {
  it("common/src/domain/worker/ ディレクトリが存在する", () => {
    expect(dirExists("common/src/domain/worker")).toBe(true);
  });

  it("common/src/domain/employee/ ディレクトリが存在しない（削除済み）", () => {
    expect(dirExists("common/src/domain/employee")).toBe(false);
  });

  it("common/src/constants/workerMessages.ts が存在しない（#539 で死蔵テンプレートを削除済み）", () => {
    expect(dirExists("common/src/constants/workerMessages.ts")).toBe(false);
  });

  it("common/src/constants/employeeMessages.ts が存在しない（削除済み）", () => {
    expect(dirExists("common/src/constants/employeeMessages.ts")).toBe(false);
  });
});

describe("Issue #329: server 永続化層の Worker 命名確認", () => {
  it("server/src/persistence/workerRepository.ts が存在する", () => {
    expect(dirExists("server/src/persistence/workerRepository.ts")).toBe(true);
  });

  it("server/src/persistence/employeeRepository.ts が存在しない（削除済み）", () => {
    expect(dirExists("server/src/persistence/employeeRepository.ts")).toBe(false);
  });

  it("server/src/persistence/prismaWorkerRepository.ts が存在する", () => {
    expect(dirExists("server/src/persistence/prismaWorkerRepository.ts")).toBe(true);
  });

  it("server/src/persistence/prismaEmployeeRepository.ts が存在しない（削除済み）", () => {
    expect(dirExists("server/src/persistence/prismaEmployeeRepository.ts")).toBe(false);
  });

  it("prismaWorkerRepository.ts に prisma.employee. 呼び出しが存在しない", () => {
    const file = "server/src/persistence/prismaWorkerRepository.ts";
    if (!dirExists(file)) return;
    const code = stripComments(readFile(file));
    expect(code).not.toMatch(/prisma\.employee\./);
  });
});

describe("Issue #329: server ルートの Worker 命名確認", () => {
  it("server/src/routes/workers.ts が存在する", () => {
    expect(dirExists("server/src/routes/workers.ts")).toBe(true);
  });

  it("server/src/routes/employees.ts が存在しない（削除済み）", () => {
    expect(dirExists("server/src/routes/employees.ts")).toBe(false);
  });

  it("server/src/routes/adminWorkerImage.ts が存在する", () => {
    expect(dirExists("server/src/routes/adminWorkerImage.ts")).toBe(true);
  });

  it("server/src/routes/adminEmployeeImage.ts が存在しない（削除済み）", () => {
    expect(dirExists("server/src/routes/adminEmployeeImage.ts")).toBe(false);
  });
});

describe("Issue #329: client API層の Worker 命名確認", () => {
  it("client/src/api/workers.ts が存在する", () => {
    expect(dirExists("client/src/api/workers.ts")).toBe(true);
  });

  it("client/src/api/employees.ts が存在しない（削除済み）", () => {
    expect(dirExists("client/src/api/employees.ts")).toBe(false);
  });
});

describe("Issue #329: client コンポーネントの Worker 命名確認", () => {
  it("client/src/components/AdminWorkerTab.tsx が存在する", () => {
    expect(dirExists("client/src/components/AdminWorkerTab.tsx")).toBe(true);
  });

  it("client/src/components/AdminEmployeeTab.tsx が存在しない（削除済み）", () => {
    expect(dirExists("client/src/components/AdminEmployeeTab.tsx")).toBe(false);
  });

  it("client/src/components/AdminWorkerTable.tsx が存在する", () => {
    expect(dirExists("client/src/components/AdminWorkerTable.tsx")).toBe(true);
  });

  it("client/src/components/AdminEmployeeTable.tsx が存在しない（削除済み）", () => {
    expect(dirExists("client/src/components/AdminEmployeeTable.tsx")).toBe(false);
  });

  it("client/src/components/WorkerTable.tsx が存在する", () => {
    expect(dirExists("client/src/components/WorkerTable.tsx")).toBe(true);
  });

  it("client/src/components/EmployeeTable.tsx が存在しない（削除済み）", () => {
    expect(dirExists("client/src/components/EmployeeTable.tsx")).toBe(false);
  });

  it("client/src/components/EditWorkerDialog.tsx が存在する", () => {
    expect(dirExists("client/src/components/EditWorkerDialog.tsx")).toBe(true);
  });

  it("client/src/components/EditEmployeeDialog.tsx が存在しない（削除済み）", () => {
    expect(dirExists("client/src/components/EditEmployeeDialog.tsx")).toBe(false);
  });

  it("client/src/components/AddWorkerDialog.tsx が存在する", () => {
    expect(dirExists("client/src/components/AddWorkerDialog.tsx")).toBe(true);
  });

  it("client/src/components/AddEmployeeDialog.tsx が存在しない（削除済み）", () => {
    expect(dirExists("client/src/components/AddEmployeeDialog.tsx")).toBe(false);
  });
});

describe("Issue #329: Prisma スキーマの Worker 命名確認", () => {
  it("schema.prisma に model Worker が定義されている", () => {
    const schema = readFile("server/prisma/schema.prisma");
    expect(schema).toMatch(/^model Worker \{/m);
  });

  it('schema.prisma に @@map("workers") が存在する', () => {
    const schema = readFile("server/prisma/schema.prisma");
    expect(schema).toMatch(/@@map\("workers"\)/);
  });

  it("schema.prisma に model Employee が残っていない", () => {
    const schema = readFile("server/prisma/schema.prisma");
    expect(schema).not.toMatch(/^model Employee \{/m);
  });
});

describe("Issue #329: server/src の prisma.employee. 呼び出しが残っていない", () => {
  it("server/src 以下のすべての .ts ファイルに prisma.employee. が存在しない", () => {
    const serverSrcDir = path.join(repoRoot, "server/src");
    const tsFiles = getAllTsFiles(serverSrcDir);
    const violations: string[] = [];

    for (const file of tsFiles) {
      const code = stripComments(readFile(path.relative(repoRoot, file)));
      if (code.includes("prisma.employee.")) {
        violations.push(path.relative(repoRoot, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
