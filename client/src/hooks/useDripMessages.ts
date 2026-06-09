import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageRecord } from "@hatchery/common";

/** タイピングインジケータの表示時間（ms）。 */
export const DRIP_TYPING_MS = 700;
/** 次のメッセージ表示開始までの待機時間（ms）。 */
export const DRIP_INTERVAL_MS = 400;

/**
 * チャンネルの新着メッセージをドリップ表示するためのフック（#282）。
 *
 * 初回マウント時の全メッセージは即時表示（過去ログ）。その後に増えた
 * 新着メッセージのみ、タイピングインジケータ付きで1件ずつ時間差表示する。
 * prefersReducedMotion が true の場合は即時表示。
 */
export function useDripMessages(
  allMessages: readonly MessageRecord[],
  prefersReducedMotion: boolean,
): { visibleMessages: readonly MessageRecord[]; typingEmployeeId: string | null } {
  const seenIds = useRef<Set<string>>(new Set());
  const queue = useRef<MessageRecord[]>([]);
  const isProcessing = useRef(false);
  const timerId = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [visibleMessages, setVisibleMessages] = useState<readonly MessageRecord[]>(() => {
    // 初回マウント時の全メッセージを「既出」として記録し即時表示
    seenIds.current = new Set(allMessages.map((m) => m.id));
    return allMessages.slice();
  });
  const [typingEmployeeId, setTypingEmployeeId] = useState<string | null>(null);

  const processNext = useCallback(() => {
    if (queue.current.length === 0) {
      isProcessing.current = false;
      return;
    }
    isProcessing.current = true;
    const next = queue.current[0];
    // 直前で length > 0 を確認済みだが、noUncheckedIndexedAccess に合わせて明示的にガードする。
    if (next === undefined) {
      isProcessing.current = false;
      return;
    }

    setTypingEmployeeId(next.createdEmployeeId);

    timerId.current = setTimeout(() => {
      setTypingEmployeeId(null);
      setVisibleMessages((prev) => [...prev, next]);
      queue.current = queue.current.slice(1);
      timerId.current = setTimeout(processNext, DRIP_INTERVAL_MS);
    }, DRIP_TYPING_MS);
  }, []); // refのみ参照 — stable

  useEffect(() => {
    return () => {
      if (timerId.current !== null) clearTimeout(timerId.current);
    };
  }, []);

  useEffect(() => {
    const newMsgs = allMessages.filter((m) => !seenIds.current.has(m.id));
    if (newMsgs.length === 0) return;

    newMsgs.forEach((m) => seenIds.current.add(m.id));

    if (prefersReducedMotion) {
      setVisibleMessages((prev) => [...prev, ...newMsgs]);
      return;
    }

    queue.current = [...queue.current, ...newMsgs];
    if (!isProcessing.current) processNext();
  }, [allMessages, prefersReducedMotion, processNext]);

  return { visibleMessages, typingEmployeeId };
}
