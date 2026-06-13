import { useCallback, useState } from "react";

import { useAuth } from "../api/auth.js";

export interface GuestVoteGuard {
  /**
   * vote 実行可否を認証状態で分岐する。認証済みなら run() を実行（= mutation 発火）し、
   * 未認証ならログイン誘導を開いて run() は実行しない（サイレント 401 を出さない・#481）。
   */
  guardVote: (run: () => void) => void;
  /** ログイン誘導スナックバーの開閉状態。 */
  promptOpen: boolean;
  /** ログイン誘導スナックバーを閉じる。 */
  closePrompt: () => void;
}

/**
 * ゲスト（未認証）が vote を押したときに API を発火せず、ログイン誘導を開くためのガードフック（#481）。
 * 認証状態は `useAuth()`（GET /auth/me・401 なら null）を単一情報源にする。
 * promptOpen はフォーム入力ではない UI のローカル状態なので useState で管理する（#262 フォーム規約の対象外）。
 */
export function useGuestVoteGuard(): GuestVoteGuard {
  const { data: authUser } = useAuth();
  const isAuthenticated = Boolean(authUser);
  const [promptOpen, setPromptOpen] = useState(false);

  const guardVote = useCallback(
    (run: () => void) => {
      if (isAuthenticated) {
        run();
        return;
      }
      setPromptOpen(true);
    },
    [isAuthenticated],
  );

  const closePrompt = useCallback(() => setPromptOpen(false), []);

  return { guardVote, promptOpen, closePrompt };
}
