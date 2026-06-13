import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * ログインモーダル（#454）の開閉状態を URL の search param（`?login=1`）で表現するフック。
 *
 * 新しいグローバル状態管理ライブラリを導入せず（CLAUDE.md）、開閉状態を URL に持たせることで
 * リロード・リダイレクト（認証ガードからの `/?login=1` 誘導）でも復元できる。
 *
 * - `isOpen`: root の search param `login` が真のとき true。
 * - `openLogin()`: 現在のパスを保ったまま `login: true` を付与してモーダルを開く（背景の閲覧コンテキストを保持）。
 * - `closeLogin()`: `login` を取り除いてモーダルを閉じる（背景はそのまま）。
 */
export function useLoginModal(): {
  isOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
} {
  const navigate = useNavigate();
  // root ルートに validateSearch を定義しているため strict:false で全ルートから login を読める。
  const search = useSearch({ strict: false }) as { login?: boolean };
  const isOpen = search.login === true;

  const openLogin = useCallback(() => {
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, login: true }),
    });
  }, [navigate]);

  const closeLogin = useCallback(() => {
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => {
        const next = { ...prev };
        delete next.login;
        return next;
      },
    });
  }, [navigate]);

  return { isOpen, openLogin, closeLogin };
}
