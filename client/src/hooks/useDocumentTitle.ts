import { useEffect } from "react";

/** OGP / 既定のドキュメントタイトル（index.html の <title> と一致）。 */
export const DEFAULT_DOCUMENT_TITLE = "Hatchery";

/**
 * ブラウザタブのタイトル（document.title）を引数の値に動的更新するフック（#256）。
 *
 * - `title` が非空文字なら `document.title` をその値にする。
 * - `title` が空文字 / undefined のときは既定（`Hatchery`）にフォールバックする。
 * - アンマウント時（別ページへ遷移したとき等）は既定タイトルへ戻し、前ページの
 *   タイトルが残らないようにする。
 *
 * SPA（ADR-0003）でのユーザー向けタブタイトル更新用。クローラ向け OGP は index.html 共通
 * （ADR-0008）で、本フックはシェア面の OGP には影響しない。
 */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    const next = title && title.length > 0 ? title : DEFAULT_DOCUMENT_TITLE;
    document.title = next;
    return () => {
      document.title = DEFAULT_DOCUMENT_TITLE;
    };
  }, [title]);
}
