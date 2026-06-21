/**
 * Graceful shutdown ヘルパー。
 *
 * Cloud Run は scale-down やデプロイのインスタンス入れ替え時に SIGTERM を送る。
 * これを無視すると、処理中のリクエストがプロセス強制終了で道連れになり 500 を返す
 * （本番 hatchery-prod でインスタンス遷移時に複数エンドポイントが同時 500 になっていた原因）。
 * SIGTERM を受けたら新規受付を止め（server.close で in-flight を排出）、その後 DB 接続を
 * 切ってからプロセスを終了する。
 */

/** server.close(cb) だけを使うため、http.Server の最小サブセットで受ける。 */
interface ClosableServer {
  close(cb?: (err?: Error) => void): unknown;
}

interface GracefulShutdownDeps {
  server: ClosableServer;
  /** DB など外部接続の切断（例: prisma.$disconnect）。 */
  disconnect: () => Promise<void>;
  /** 失敗時のログ出力（既定: console.error）。throw はしない。 */
  onError?: (err: unknown) => void;
  /** 進行ログ（既定: console.log）。 */
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
  onError = console.error,
  log = console.log,
}: GracefulShutdownDeps): Promise<void> {
  log("[server] graceful shutdown: closing server (draining in-flight requests)");
  await new Promise<void>((resolve) => {
    server.close((err) => {
      if (err) onError(err);
      resolve();
    });
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
}

/**
 * SIGTERM / SIGINT を購読し、受信したら gracefulShutdown を実行して exit(0) する。
 * 多重シグナル（SIGTERM 後さらに来る等）でも shutdown は 1 回だけ実行する。
 */
export function registerGracefulShutdown({
  server,
  disconnect,
  signals = ["SIGTERM", "SIGINT"],
  exit = (code) => process.exit(code),
  process: proc = process,
  onError = console.error,
  log = console.log,
}: RegisterGracefulShutdownDeps): void {
  let shuttingDown = false;
  for (const signal of signals) {
    proc.on(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      log(`[server] received ${signal}, starting graceful shutdown`);
      void gracefulShutdown({ server, disconnect, onError, log }).finally(() => exit(0));
    });
  }
}
