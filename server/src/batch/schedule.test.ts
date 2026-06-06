import { describe, expect, it, vi } from "vitest";

import { InMemoryMessageRepository } from "../persistence/messageRepository.js";

import { runMessageBatch } from "./runMessageBatch.js";
import {
  DEFAULT_BATCH_HOURS,
  MAX_BATCH_RUNS_PER_DAY,
  msUntilNext,
  resolveBatchHours,
  startMessageBatchScheduler,
  type SchedulerPort,
} from "./schedule.js";

describe("resolveBatchHours — BATCH_SCHEDULE の解決（#53・1日4回まで）", () => {
  it("未設定なら DEFAULT_BATCH_HOURS を返す", () => {
    expect(resolveBatchHours(undefined)).toEqual([...DEFAULT_BATCH_HOURS]);
  });

  it("空文字なら DEFAULT_BATCH_HOURS を返す", () => {
    expect(resolveBatchHours("")).toEqual([...DEFAULT_BATCH_HOURS]);
  });

  it("カンマ区切りの時をパースする", () => {
    expect(resolveBatchHours("8,13,20")).toEqual([8, 13, 20]);
  });

  it("最大 4 件（MAX_BATCH_RUNS_PER_DAY）に制限する", () => {
    expect(resolveBatchHours("1,2,3,4,5,6")).toEqual([1, 2, 3, 4]);
    expect(MAX_BATCH_RUNS_PER_DAY).toBe(4);
  });

  it("0-23 範囲外・非数値を除外する", () => {
    expect(resolveBatchHours("9, 25, foo, 12")).toEqual([9, 12]);
  });

  it("空セグメント（二重カンマ・末尾カンマ）は 0 にせず除外する", () => {
    expect(resolveBatchHours("9,,12")).toEqual([9, 12]);
    expect(resolveBatchHours("9,12,")).toEqual([9, 12]);
  });

  it("有効な時が無ければ DEFAULT_BATCH_HOURS にフォールバックする", () => {
    expect(resolveBatchHours("99,abc")).toEqual([...DEFAULT_BATCH_HOURS]);
  });
});

describe("msUntilNext — 次の発火までの待ち時間（#32, ローカル時刻基準）", () => {
  it("当日のまだ来ていない時刻なら当日までの正の ms を返す", () => {
    const now = new Date(2026, 4, 30, 8, 0, 0, 0);
    const ms = msUntilNext(9, 0, now);
    expect(ms).toBe(60 * 60 * 1000);
  });

  it("当日の過ぎた時刻なら翌日分（正）を返す", () => {
    const now = new Date(2026, 4, 30, 10, 0, 0, 0);
    const ms = msUntilNext(9, 0, now);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBe(23 * 60 * 60 * 1000);
  });

  it("ちょうど同時刻なら翌日分（24h）を返す", () => {
    const now = new Date(2026, 4, 30, 9, 0, 0, 0);
    const ms = msUntilNext(9, 0, now);
    expect(ms).toBe(24 * 60 * 60 * 1000);
  });
});

describe("startMessageBatchScheduler — 1 日数回の定時実行（#32）", () => {
  it("既定では DEFAULT_BATCH_HOURS の回数だけジョブを登録する", () => {
    const scheduled: Array<{ hour: number; minute: number }> = [];
    const fake: SchedulerPort = {
      scheduleDaily(hour, minute) {
        scheduled.push({ hour, minute });
        return () => {};
      },
    };
    startMessageBatchScheduler(async () => {}, { scheduler: fake });
    expect(scheduled.map((s) => s.hour)).toEqual([...DEFAULT_BATCH_HOURS]);
  });

  it("指定した hours の数だけ登録する", () => {
    const scheduled: number[] = [];
    const fake: SchedulerPort = {
      scheduleDaily(hour) {
        scheduled.push(hour);
        return () => {};
      },
    };
    startMessageBatchScheduler(async () => {}, { hours: [9, 18], scheduler: fake });
    expect(scheduled).toEqual([9, 18]);
  });

  it("登録ハンドラを発火するとジョブが実行される（モック可能）", async () => {
    let handler: (() => void) | undefined;
    const fake: SchedulerPort = {
      scheduleDaily(_hour, _minute, h) {
        handler = h;
        return () => {};
      },
    };
    const repo = new InMemoryMessageRepository();
    const run = vi.fn(() =>
      runMessageBatch({
        messageRepository: repo,
        generate: () => [{ speaker: "haru", channel: "zatsudan", text: "やあ" }],
      }),
    );
    startMessageBatchScheduler(run, { hours: [9], scheduler: fake });
    expect(handler).toBeTypeOf("function");
    handler?.();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    await vi.waitFor(async () => expect(await repo.list()).toHaveLength(1));
  });

  it("返り値の cancel で全ジョブを解除できる", () => {
    const cancels: Array<() => void> = [];
    const fake: SchedulerPort = {
      scheduleDaily() {
        const cancel = vi.fn();
        cancels.push(cancel);
        return cancel;
      },
    };
    const cancelAll = startMessageBatchScheduler(async () => {}, { hours: [9, 12], scheduler: fake });
    cancelAll();
    for (const cancel of cancels) {
      expect(cancel).toHaveBeenCalledTimes(1);
    }
  });
});
