import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppSettingRepository } from "../persistence/appSettingRepository.js";
import { InMemoryChannelRepository } from "../persistence/channelRepository.js";
import { InMemoryMessageRepository } from "../persistence/messageRepository.js";
import { encrypt } from "../utils/crypto.js";
import { type UxProposal, runPlanningBatch } from "./planningBatch.js";

/** fetch をモックする */
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("runPlanningBatch (#76)", () => {
  let channelRepo: InMemoryChannelRepository;
  let messageRepo: InMemoryMessageRepository;
  let appSettingRepo: AppSettingRepository;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    channelRepo = new InMemoryChannelRepository();
    messageRepo = new InMemoryMessageRepository();
    appSettingRepo = {
      findAll: vi.fn().mockResolvedValue([]),
      findByKey: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("ANTHROPIC_API_KEY が未設定ならスキップして空配列を返す", async () => {
    const env = { ...process.env };
    delete env["ANTHROPIC_API_KEY"];
    process.env = env;

    const result = await runPlanningBatch({ channelRepo, messageRepo, appSettingRepo });
    expect(result).toHaveLength(0);
  });

  it("企画チャンネルが存在しなければメッセージ保存せず空配列を返す", async () => {
    process.env = { ...process.env, ANTHROPIC_API_KEY: "test-key" };
    // 空リストで初期化することで kikaku チャンネルを含まない状態を作る
    channelRepo = new InMemoryChannelRepository([]);

    const result = await runPlanningBatch({ channelRepo, messageRepo, appSettingRepo });
    expect(result).toHaveLength(0);
  });

  it("提案を生成してメッセージを保存する", async () => {
    // channelRepo は DEFAULT_CHANNELS（kikaku を含む）で初期化済み
    process.env = { ...process.env, ANTHROPIC_API_KEY: "test-key", CLIENT_URL: "http://localhost:3000" };

    // fetch のモック（HTML レスポンス）
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<html><body><h1>ログイン画面</h1></body></html>"),
    });

    // generateUxProposals をモック
    const proposals: UxProposal[] = [
      {
        title: "ログインボタンの色を改善する",
        reason: "コントラスト比が WCAG 基準を下回っている",
        targetUrl: "/login",
      },
    ];

    const result = await runPlanningBatch({
      channelRepo,
      messageRepo,
      appSettingRepo,
      generateProposals: vi.fn().mockResolvedValue(proposals),
    });

    expect(result).toHaveLength(1);
    expect(result[0].speaker).toBe("ai-planner");
    expect(result[0].proposalTitle).toBe("ログインボタンの色を改善する");
    expect(result[0].proposalTargetUrl).toBe("/login");
  });

  it("提案生成が空配列を返したらメッセージを保存しない", async () => {
    // channelRepo は DEFAULT_CHANNELS（kikaku を含む）で初期化済み
    process.env = { ...process.env, ANTHROPIC_API_KEY: "test-key" };

    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<html><body></body></html>"),
    });

    const result = await runPlanningBatch({
      channelRepo,
      messageRepo,
      appSettingRepo,
      generateProposals: vi.fn().mockResolvedValue([]),
    });

    expect(result).toHaveLength(0);
    const saved = await messageRepo.list();
    expect(saved).toHaveLength(0);
  });

  it("DB に CLAUDE_API_KEY が保存されている場合は env よりも DB の値を優先して使う", async () => {
    // env には ANTHROPIC_API_KEY を設定しない（DB キーだけが存在する状態）
    const env = { ...process.env, CLIENT_URL: "http://localhost:3000" };
    delete env["ANTHROPIC_API_KEY"];
    process.env = env;

    // DB に暗号化済みの API キーを設定
    const encryptedKey = encrypt("db-api-key");
    (appSettingRepo.findByKey as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "CLAUDE_API_KEY",
      value: encryptedKey,
      updatedAt: new Date(),
    });

    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<html><body>test</body></html>"),
    });

    const mockGenerate = vi.fn().mockResolvedValue([]);
    await runPlanningBatch({
      channelRepo,
      messageRepo,
      appSettingRepo,
      generateProposals: mockGenerate,
    });

    // DB からキーが取得され generateProposals が呼ばれた（スキップされていない）
    expect(mockGenerate).toHaveBeenCalledWith(expect.any(Object), "db-api-key");
  });
});
