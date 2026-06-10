import { describe, expect, it } from "vitest";

import { MAX_MESSAGE_LENGTH } from "../domain/message/index.js";
import { DEFAULT_WORKERS } from "../domain/worker/index.js";

import { WORKER_MESSAGE_TEMPLATES, getWorkerMessageTemplates } from "./workerMessages.js";

describe("WORKER_MESSAGE_TEMPLATES — 静的発言テンプレート（#32 MVP）", () => {
  it("DEFAULT_WORKERS 全員分のテンプレートが存在する", () => {
    for (const worker of DEFAULT_WORKERS) {
      const templates = WORKER_MESSAGE_TEMPLATES[worker.id];
      expect(templates, `テンプレート未定義: ${worker.id}`).toBeDefined();
      expect(templates.length).toBeGreaterThan(0);
    }
  });

  it("各文言は非空かつ MAX_MESSAGE_LENGTH 以内（MessageSchema と整合）", () => {
    for (const templates of Object.values(WORKER_MESSAGE_TEMPLATES)) {
      for (const text of templates) {
        expect(text.length).toBeGreaterThan(0);
        expect(text.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
      }
    }
  });

  it("getWorkerMessageTemplates は既知 id でテンプレートを、未知 id で空配列を返す", () => {
    expect(getWorkerMessageTemplates("haru").length).toBeGreaterThan(0);
    expect(getWorkerMessageTemplates("unknown-id")).toEqual([]);
  });
});
