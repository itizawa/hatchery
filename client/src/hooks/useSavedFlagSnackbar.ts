import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import type { SettingsTabValue } from "../routes/settingsTabValues.js";

/**
 * 管理画面（/admin）の一覧タブで、編集ページの保存成功後に付与される一時フラグ
 * （`workerSaved` #1080 / `communitySaved` #1081 等）を検知し、成功 Snackbar を
 * 一度だけ表示してから URL から即座にフラグを除去する共通フック。
 *
 * `useLoginModal`（#588）同様、新しいグローバル状態管理・Toast コンテキストは導入せず
 * （CLAUDE.md）、URL の search param を一時フラグとして使う既存方針を踏襲する。
 */
export function useSavedFlagSnackbar({
  flag,
  tab,
}: {
  flag: boolean | undefined;
  tab: SettingsTabValue;
}): {
  open: boolean;
  close: () => void;
} {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (flag) {
      setOpen(true);
      void navigate({ to: "/admin", search: { tab }, replace: true });
    }
  }, [flag]);

  return { open, close: () => setOpen(false) };
}
