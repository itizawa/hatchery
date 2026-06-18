import { useCallback, useState } from "react";

export type ViewMode = "card" | "compact";

const STORAGE_KEY = "feedViewMode";

export interface UseViewModeReturn {
  viewMode: ViewMode;
  toggleViewMode: () => void;
}

function readStoredMode(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "compact") return "compact";
  } catch {
    // localStorage が使えない環境では無視
  }
  return "card";
}

/**
 * フィード表示モード（card / compact）を localStorage に永続化する hook（#561）。
 */
export function useViewMode(): UseViewModeReturn {
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredMode);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next: ViewMode = prev === "card" ? "compact" : "card";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage が使えない環境では無視
      }
      return next;
    });
  }, []);

  return { viewMode, toggleViewMode };
}
