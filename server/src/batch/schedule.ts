/**
 * 定時バッチのスケジューリング（#32）。
 * 「1 日数回の定時」を表現し、テストでモックできるよう副作用を SchedulerPort に隔離する。
 * 時刻計算は純粋関数 msUntilNext に切り出して直接テスト可能にする（実タイマー依存を避ける）。
 * 外部スケジューラ依存（node-schedule 等）を持たず、setTimeout ベースの SystemScheduler を既定とする。
 */

/** MVP の既定の定時（ローカル時刻の時）。1 日 4 回。 */
export const DEFAULT_BATCH_HOURS = [9, 12, 15, 18] as const;

/** 定時バッチの 1 日あたり最大実行回数（#53）。これを超える設定は切り捨てる。 */
export const MAX_BATCH_RUNS_PER_DAY = 4;

/**
 * 環境変数 BATCH_SCHEDULE（カンマ区切りの時。例 "9,12,15,18"）から定時の時配列を解決する（#53）。
 * - 0–23 の整数のみ採用し、それ以外（範囲外・非数値）は除外する。
 * - 有効な時を最大 MAX_BATCH_RUNS_PER_DAY（=4）件に制限する（1 日 4 回まで）。
 * - 未設定・空・有効な時が 1 件も無い場合は DEFAULT_BATCH_HOURS にフォールバックする。
 * 実運用ではこの値を外部 cron（Cloud Run / GitHub Actions）の起動時刻に反映させる想定。
 */
export function resolveBatchHours(envValue?: string): number[] {
  if (!envValue) return [...DEFAULT_BATCH_HOURS];
  const parsed = envValue
    .split(",")
    .map((part) => part.trim())
    // 空セグメント（"9,,12" や "9,12," 等のタイポ）は除外する。Number("") は 0 になり 0:00 を誤って混入させるため。
    .filter((part) => part !== "")
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 23);
  if (parsed.length === 0) return [...DEFAULT_BATCH_HOURS];
  return parsed.slice(0, MAX_BATCH_RUNS_PER_DAY);
}

/**
 * now（ローカル時刻基準）から、次に hour:minute が訪れるまでの ms を返す。
 * 当日の同時刻ちょうど・過去なら翌日分を返す（常に正）。
 */
export function msUntilNext(hour: number, minute: number, now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

/** スケジューリングの副作用境界（ポート）。テストではフェイク実装を注入する。 */
export interface SchedulerPort {
  /**
   * 毎日 hour:minute に handler を呼ぶジョブを登録し、解除関数を返す。
   */
  scheduleDaily(hour: number, minute: number, handler: () => void): () => void;
}

/**
 * 再登録時の最小待機（ms）。setTimeout がわずかに早く発火した場合、再登録時点の現在時刻が
 * まだ当日の hour:minute 直前に見え、msUntilNext がごく小さい値を返して同一定時で二重発火しうる。
 * これを下回る待機は「直前の定時を発火済み」とみなし翌日（+24h）へ送ることで二重発火を防ぐ。
 */
const MIN_REARM_DELAY_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** setTimeout ベースの既定スケジューラ。発火後に翌日分を再登録して日次運用する。 */
export class SystemScheduler implements SchedulerPort {
  scheduleDaily(hour: number, minute: number, handler: () => void): () => void {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const arm = (): void => {
      // 早発火による二重発火を防ぐため、極端に短い待機は翌日へ繰り上げる。
      const delay = msUntilNext(hour, minute);
      const safeDelay = delay < MIN_REARM_DELAY_MS ? delay + DAY_MS : delay;
      timer = setTimeout(() => {
        if (cancelled) return;
        handler();
        arm(); // 翌日分を再登録して日次運用する。
      }, safeDelay);
    };

    arm();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }
}

/** startMessageBatchScheduler のオプション。 */
export interface StartSchedulerOptions {
  /** 定時の時（ローカル時刻）。既定 DEFAULT_BATCH_HOURS。 */
  hours?: readonly number[];
  /** 各定時の分（既定 0）。 */
  minute?: number;
  /** スケジューラ実装（既定 SystemScheduler）。テストでフェイクを注入する。 */
  scheduler?: SchedulerPort;
}

/**
 * 1 日数回の定時に run を実行するスケジューラを起動する（#32）。
 * 各定時ごとにジョブを登録し、全ジョブを解除する cancel 関数を返す。
 * run の失敗はプロセスを落とさずログに留める（次回の定時は継続させる）。
 */
export function startMessageBatchScheduler(
  run: () => Promise<unknown>,
  options: StartSchedulerOptions = {},
): () => void {
  const hours = options.hours ?? DEFAULT_BATCH_HOURS;
  const minute = options.minute ?? 0;
  const scheduler = options.scheduler ?? new SystemScheduler();

  const cancels = hours.map((hour) =>
    scheduler.scheduleDaily(hour, minute, () => {
      void run().catch((err: unknown) => {
        console.error("[batch] 定時実行に失敗しました", err);
      });
    }),
  );

  return () => {
    for (const cancel of cancels) cancel();
  };
}
