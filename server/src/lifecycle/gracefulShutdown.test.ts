import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { gracefulShutdown, registerGracefulShutdown } from "./gracefulShutdown.js";

/** server.close(cb) を模したフェイク。close 完了で cb を呼ぶ。 */
function fakeServer({ closeError }: { closeError?: Error } = {}) {
  const calls = { closed: 0 };
  return {
    calls,
    close(cb?: (err?: Error) => void) {
      calls.closed += 1;
      cb?.(closeError);
      return this;
    },
  };
}

describe("gracefulShutdown", () => {
  it("server.close → disconnect の順で実行し解決する", async () => {
    const order: string[] = [];
    const server = fakeServer();
    const disconnect = vi.fn(async () => {
      order.push("disconnect");
    });
    const origClose = server.close.bind(server);
    server.close = (cb) => {
      order.push("close");
      return origClose(cb);
    };

    await gracefulShutdown({ server, disconnect });

    expect(server.calls.closed).toBe(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["close", "disconnect"]);
  });

  it("disconnect が失敗しても reject せず onError に渡す", async () => {
    const server = fakeServer();
    const err = new Error("disconnect failed");
    const onError = vi.fn();

    await expect(
      gracefulShutdown({
        server,
        disconnect: async () => {
          throw err;
        },
        onError,
      }),
    ).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledWith(err);
  });

  it("server.close がエラーを返しても disconnect は実行される", async () => {
    const closeError = new Error("close failed");
    const server = fakeServer({ closeError });
    const onError = vi.fn();
    const disconnect = vi.fn(async () => {});

    await gracefulShutdown({ server, disconnect, onError });

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(closeError);
  });
});

describe("registerGracefulShutdown", () => {
  it("SIGTERM 受信で shutdown を実行し exit(0) する", async () => {
    const proc = new EventEmitter();
    const server = fakeServer();
    const disconnect = vi.fn(async () => {});
    const exit = vi.fn();

    registerGracefulShutdown({
      server,
      disconnect,
      exit,
      process: proc,
      signals: ["SIGTERM"],
    });

    proc.emit("SIGTERM");
    // shutdown は非同期なのでマイクロタスクを流す。
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(server.calls.closed).toBe(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("シグナルが複数回来ても shutdown は 1 回だけ実行する", async () => {
    const proc = new EventEmitter();
    const server = fakeServer();
    const disconnect = vi.fn(async () => {});
    const exit = vi.fn();

    registerGracefulShutdown({
      server,
      disconnect,
      exit,
      process: proc,
      signals: ["SIGTERM"],
    });

    proc.emit("SIGTERM");
    proc.emit("SIGTERM");
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());
    expect(server.calls.closed).toBe(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
