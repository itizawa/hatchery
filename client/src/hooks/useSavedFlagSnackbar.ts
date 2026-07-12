import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * 管理画面（/admin）の一覧タブで、編集ページの保存成功後に付与される一時フラグ
 * （`workerSaved` #1080 / `communitySaved` #1081 等）を検知し、成功 Snackbar を
 * 一度だけ表示してから URL から即座にフラグを除去する共通フック。
 *
 * `useLoginModal`（#588）同様、新しいグローバル状態管理・Toast コンテキストは導入せず
 * （CLAUDE.md）、URL の search param を一時フラグとして使う既存方針を踏襲する。
 *
 * navigate の search は `prev` からの関数更新で自分の `flagKey` だけを取り除く（他の
 * search param・別の saved フラグを保持する）。リテラルオブジェクトで search 全体を
 * 置き換えると、まだ消費されていない別のフラグ（例: workerSaved と communitySaved が
 * 同時に URL に存在する場合）を意図せず消してしまうため。
 */
export function useSavedFlagSnackbar({
  flag,
  flagKey,
}: {
  flag: boolean | undefined;
  flagKey: "workerSaved" | "communitySaved";
}): {
  open: boolean;
  close: () => void;
} {
  const navigate = useNavigate({ from: "/admin" });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (flag) {
      setOpen(true);
      void navigate({
        search: (prev) => {
          const next = { ...prev };
          delete next[flagKey];
          return next;
        },
        replace: true,
      });
    }
  }, [flag, flagKey, navigate]);

  return { open, close: () => setOpen(false) };
}
