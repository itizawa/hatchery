import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";
import { InMemoryEmployeeRepository } from "../persistence/employeeRepository.js";
import { InMemoryUserRepository } from "../persistence/userRepository.js";
import { createTestDeps } from "../testing/createTestDeps.js";
import { InMemoryStorageService } from "../services/storageService.js";

/** テスト用のデフォルト Employee データ */
const defaultEmployees = [
  { id: "haru", displayName: "haru", role: "ムードメーカー", isBot: true, personality: null, imageUrl: null },
];

async function makeApp(role: "admin" | "member" = "admin") {
  const userRepo = await InMemoryUserRepository.createWithTestUser(null, role);
  const employeeRepo = new InMemoryEmployeeRepository(defaultEmployees);
  const storageService = new InMemoryStorageService();
  return createApp(
    await createTestDeps({
      userRepository: userRepo,
      employeeRepository: employeeRepo,
      storageService,
    }),
  );
}

async function loginAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ loginId: "testuser", password: "testpass" });
  return agent;
}

describe("POST /api/admin/employees/:id/image（#204）", () => {
  it("未認証なら 401 を返す", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/api/admin/employees/haru/image")
      .attach("image", Buffer.from("fake"), { filename: "avatar.png", contentType: "image/png" });
    expect(res.status).toBe(401);
  });

  it("member ユーザーなら 403 を返す", async () => {
    const app = await makeApp("member");
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/employees/haru/image")
      .attach("image", Buffer.from("fake"), { filename: "avatar.png", contentType: "image/png" });
    expect(res.status).toBe(403);
  });

  it("admin ユーザーが有効な画像をアップロードすると 200 と imageUrl を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/employees/haru/image")
      .attach("image", Buffer.from("fake-png-data"), { filename: "avatar.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("imageUrl");
    expect(typeof (res.body as { imageUrl: string }).imageUrl).toBe("string");
  });

  it("存在しない employee ID なら 404 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/employees/nonexistent/image")
      .attach("image", Buffer.from("fake"), { filename: "avatar.png", contentType: "image/png" });
    expect(res.status).toBe(404);
  });

  it("MIME が image/png, image/jpeg, image/webp, image/gif 以外なら 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent
      .post("/api/admin/employees/haru/image")
      .attach("image", Buffer.from("fake"), { filename: "document.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(400);
  });

  it("ファイルサイズが 5MB を超えると 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const bigBuffer = Buffer.alloc(5 * 1024 * 1024 + 1); // 5MB + 1 byte
    const res = await agent
      .post("/api/admin/employees/haru/image")
      .attach("image", bigBuffer, { filename: "big.png", contentType: "image/png" });
    expect(res.status).toBe(400);
  });

  it("ファイルが添付されていないなら 400 を返す", async () => {
    const app = await makeApp();
    const agent = await loginAgent(app);
    const res = await agent.post("/api/admin/employees/haru/image");
    expect(res.status).toBe(400);
  });
});
