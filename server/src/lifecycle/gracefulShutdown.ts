/**
 * Graceful shutdown ヘルパー。
 *
 * Cloud Run は scale-down やデプロイのインスタンス入れ替え時に SIGTERM を送る。
 * これを無視すると、処理中のリクエストがプロセス強制終了で道連れになり 500 を返す
 * （本番 hatchery-prod でインスタンス遷移時に複数エンドポイントが同時 500 になっていた原因）。
 * SIGTERM を受けたら新規受付を止め（server.close で in-flight を排出）、その後 DB 接続を
 * 切ってからプロセスを終了する。
 */

import { logError, logInfo } from "../logger.js";

/** http.Server の最小サブセットで受ける（テストでフェイクに差し替え可能にする）。 */
interface ClosableServer {
  close(cb?: (err?: Error) => void): unknown;
  /** アイドルな keep-alive 接続を閉じる（Node 18.2+）。省略可能。 */
  closeIdleConnections?(): void;
}

interface GracefulShutdownDeps {
  server: ClosableServer;
  /** DB など外部接続の切断（例: prisma.$disconnect）。 */
  disconnect: () => Promise<void>;
  /** 失敗時のログ出力（既定: 構造化ログ）。throw はしない。 */
  onError?: (err: unknown) => void;
  /** 進行ログ（既定: 構造化ログ）。 */
  log?: (message: string) => void;
}

/**
 * server を閉じて in-flight を排出し、その後 disconnect する。
 * close / disconnect が失敗しても reject せず onError に渡して継続する
 * （shutdown 経路で例外を投げると終了処理が中断するため）。
 */
export async function gracefulShutdown({
  server,
  disconnect,
  onError = (err: unknown) => logError({ event: "server.shutdown_error", err }),
  log = (message: string) => logInfo({ event: "server.lifecycle", fields: { message } }),
}: GracefulShutdownDeps): Promise<void> {
  log("[server] graceful shutdown: closing server (draining in-flight requests)");
  await new Promise<void>((resolve) => {
    server.close((err) => {
      if (err) onError(err);
      resolve();
    });
    // アイドルな keep-alive 接続は server.close だけでは閉じず close コールバックが
    // 発火しない。明示的に閉じて drain を確実に完了させる（処理中リクエストは保持される）。
    server.closeIdleConnections?.();
  });

  log("[server] graceful shutdown: disconnecting database");
  try {
    await disconnect();
  } catch (err) {
    onError(err);
  }
  log("[server] graceful shutdown: done");
}

/** process.on / process.exit の最小サブセット（テストで差し替え可能にする）。 */
interface SignalProcess {
  on(event: string, listener: () => void): unknown;
}

interface RegisterGracefulShutdownDeps extends GracefulShutdownDeps {
  /** 監視するシグナル（既定: SIGTERM / SIGINT）。 */
  signals?: string[];
  /** プロセス終了（既定: process.exit）。 */
  exit?: (code: number) => void;
  /** シグナルを購読する対象（既定: グローバル process）。 */
  process?: SignalProcess;
  /**
   * shutdown がこの時間内に完了しなければ強制終了する（既定: 10s）。
   * server.close が（想定外の接続残り等で）返らずハングしても、Cloud Run の
   * 強制 SIGKILL を待たずにこちらから終了するためのフォールバック。
   */
  forceExitAfterMs?: number;
}

/**
 * SIGTERM / SIGINT を購読し、受信したら gracefulShutdown を実行して exit(0) する。
 * 多重シグナル（SIGTERM 後さらに来る等）でも shutdown は 1 回だけ実行する。
 * shutdown が forceExitAfterMs 内に終わらなければ exit(1) で強制終了する。
 */
export function registerGracefulShutdown({
  server,
  disconnect,
  signals = ["SIGTERM", "SIGINT"],
  exit = (code) => process.exit(code),
  process: proc = process,
  onError = (err: unknown) => logError({ event: "server.shutdown_error", err }),
  log = (message: string) => logInfo({ event: "server.lifecycle", fields: { message } }),
  forceExitAfterMs = 10_000,
}: RegisterGracefulShutdownDeps): void {
  let shuttingDown = false;
  for (const signal of signals) {
    proc.on(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      log(`[server] received ${signal}, starting graceful shutdown`);

      let exited = false;
      const timer = setTimeout(() => {
        if (exited) return;
        exited = true;
        log(`[server] graceful shutdown timed out after ${forceExitAfterMs}ms, forcing exit`);
        exit(1);
      }, forceExitAfterMs);
      // タイマー自体がイベントループを生かし続けて終了を妨げないようにする。
      if (typeof timer.unref === "function") timer.unref();

      void gracefulShutdown({ server, disconnect, onError, log }).finally(() => {
        if (exited) return;
        exited = true;
        clearTimeout(timer);
        exit(0);
      });
    });
  }
}
