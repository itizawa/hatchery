import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createElement } from "react";

import { ExternalLinkDialog } from "../components/ExternalLinkDialog.js";

/** window.localStorage のキー。全外部リンク共通・ブラウザ単位で永続化。 */
const STORAGE_KEY = "hatchery:external-link:skip-warning";

/** 外部リンク確認フロー（Issue #661）で「外部リンク」を判定する関数。
 *
 * 判定基準: `http(s)` スキームかつアプリのオリジンと異なる host であること。
 * - 相対パス・同一オリジン・非 http(s) スキームは全て false を返す。
 * - `new URL()` の解析エラー（不正な URL）は false として扱う。
 */
export function isExternalUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin !== window.location.origin
    );
  } catch {
    return false;
  }
}

interface ExternalLinkContextValue {
  /** 外部リンクを開く。`skipWarning` 設定済みの場合は直接開き、未設定の場合は確認モーダルを表示する。 */
  openExternalLink: (url: string) => void;
}

const ExternalLinkContext = createContext<ExternalLinkContextValue | null>(null);

interface ExternalLinkProviderProps {
  children: ReactNode;
}

/**
 * 外部リンク確認モーダルの Provider（Issue #661）。
 *
 * アプリのルートレベル（`RootLayout.tsx` 内）にマウントし、
 * 配下のコンポーネントから `useExternalLink()` で `openExternalLink` を呼べるようにする。
 *
 * 設計: `useLoginModal.ts` の URL search param 方式とは異なり、
 * 一過性のモーダル状態（pendingUrl）を React state で管理する。
 * 新しいグローバル状態管理ライブラリは導入しない（CLAUDE.md）。
 */
export function ExternalLinkProvider({ children }: ExternalLinkProviderProps) {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [skipWarning, setSkipWarning] = useState<boolean>(
    () => window.localStorage.getItem(STORAGE_KEY) === "true",
  );

  const openExternalLink = useCallback(
    (url: string) => {
      if (!isExternalUrl(url)) {
        // 内部リンクや非 http(s) スキームは何もしない
        return;
      }
      if (skipWarning || window.localStorage.getItem(STORAGE_KEY) === "true") {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      setPendingUrl(url);
    },
    [skipWarning],
  );

  const handleClose = useCallback(() => {
    setPendingUrl(null);
  }, []);

  const handleContinue = useCallback(() => {
    if (pendingUrl) {
      window.open(pendingUrl, "_blank", "noopener,noreferrer");
    }
    if (skipWarning) {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    setPendingUrl(null);
  }, [pendingUrl, skipWarning]);

  const handleSkipWarningChange = useCallback((value: boolean) => {
    setSkipWarning(value);
  }, []);

  return createElement(
    ExternalLinkContext.Provider,
    { value: { openExternalLink } },
    children,
    pendingUrl != null
      ? createElement(ExternalLinkDialog, {
          open: pendingUrl != null,
          url: pendingUrl ?? "",
          onClose: handleClose,
          onContinue: handleContinue,
          skipWarning,
          onSkipWarningChange: handleSkipWarningChange,
        })
      : null,
  );
}

/**
 * 外部リンクを確認モーダル経由で開くフック（Issue #661）。
 *
 * `ExternalLinkProvider` の配下でのみ使用可能。
 * Provider の外で呼んだ場合は Error を throw する。
 */
export function useExternalLink(): ExternalLinkContextValue {
  const ctx = useContext(ExternalLinkContext);
  if (!ctx) {
    throw new Error("useExternalLink は ExternalLinkProvider の配下で使用してください");
  }
  return ctx;
}
