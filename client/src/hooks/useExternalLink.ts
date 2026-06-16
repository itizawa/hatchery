import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createElement } from "react";

import { ExternalLinkDialog } from "../components/ExternalLinkDialog.js";

/** window.localStorage のキー。全外部リンク共通・ブラウザ単位で永続化。 */
const STORAGE_KEY = "hatchery:external-link:skip-warning";

/** localStorage へのアクセスを安全に行うヘルパー。
 * Node.js 26 の実験的 localStorage は --localstorage-file 未指定で undefined になるため
 * Optional chaining でガードする。 */
function storageGet(key: string): string | null {
  return window.localStorage?.getItem(key) ?? null;
}

function storageSet(key: string, value: string): void {
  window.localStorage?.setItem(key, value);
}

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

/** Provider 未使用時のフォールバック: モーダルを挟まず直接 window.open する。
 * テスト等 Provider を持たない環境での安全な後退動作として使う。 */
const fallbackContextValue: ExternalLinkContextValue = {
  openExternalLink: (url: string) => {
    if (isExternalUrl(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  },
};

const ExternalLinkContext = createContext<ExternalLinkContextValue>(fallbackContextValue);

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
    () => storageGet(STORAGE_KEY) === "true",
  );

  const openExternalLink = useCallback(
    (url: string) => {
      if (!isExternalUrl(url)) {
        // 内部リンクや非 http(s) スキームは何もしない
        return;
      }
      if (skipWarning || storageGet(STORAGE_KEY) === "true") {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      setPendingUrl(url);
    },
    [skipWarning],
  );

  const handleClose = useCallback(() => {
    // チェックボックスの変更は「続行」時のみ確定する。
    // キャンセル時はチェック状態をリセットし、次回モーダル表示時に初期値に戻す。
    setSkipWarning(storageGet(STORAGE_KEY) === "true");
    setPendingUrl(null);
  }, []);

  const handleContinue = useCallback(() => {
    if (pendingUrl) {
      window.open(pendingUrl, "_blank", "noopener,noreferrer");
    }
    if (skipWarning) {
      storageSet(STORAGE_KEY, "true");
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
          open: true,
          url: pendingUrl,
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
 * `ExternalLinkProvider` の配下で使用すると確認モーダルを経由する。
 * Provider の外（テスト等）では直接 window.open するフォールバック動作をする。
 */
export function useExternalLink(): ExternalLinkContextValue {
  return useContext(ExternalLinkContext);
}
