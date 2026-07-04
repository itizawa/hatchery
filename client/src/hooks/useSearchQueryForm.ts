import { useForm } from "@tanstack/react-form";
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

const SEARCH_PATHNAME = "/search";

/** ヘッダー常設欄・`/search` ページ本体の双方が共有する検索キーワードの文字数上限（#1055）。 */
export const SEARCH_QUERY_MAX_LENGTH = 200;

/**
 * `/search` の `q` を扱う検索フォーム共通ロジック（#1055）。
 * ヘッダー常設検索欄（`AppHeader`）とページ本体（`SearchScene`）の双方が同じ
 * 「現在の q を初期値にし、送信でトリムした q を持って /search へ遷移する」挙動を共有する。
 *
 * `/search` 以外のページでは、そのページ自身の search param に偶然 `q` キーが
 * 含まれていても（`validateSearch` を持たないルートは未知のキーを素通りさせるため）
 * 検索欄に無関係な文字列を出さないよう、`q` は `/search` を開いている間だけ読む。
 *
 * `preserveUnsyncedEdits: true`（ヘッダー用）は、未送信の編集中に別ページへ遷移しても
 * 入力内容を失わないようにする。`false`（`SearchScene` 用・既定）は、`/search` ページ自身の
 * 表示（検索結果）と入力欄を常に一致させるため、未送信の編集があっても `q` の変化（ブラウザの
 * 戻る/進む等）に追従してリセットする（TanStack Router は search param のみの遷移では
 * コンポーネントを再マウントしないため、効果で同期する必要がある）。
 *
 * 追従が必要かどうかの判定には `@tanstack/react-form` の `isDirty` を使わない。
 * `isDirty` は一度でも編集すると `reset()` するまで true のまま残る「一度きりのフラグ」
 * （フィールド値を defaultValues に戻しても false には戻らない）であり、これをガードに使うと
 * 一度でも編集した後は二度と `q` の変化に追従しなくなってしまう。代わりに、直前に同期した
 * 値を ref で保持し、現在のフィールド値と比較するライブな判定を行う。
 */
export function useSearchQueryForm(
  { preserveUnsyncedEdits = false }: { preserveUnsyncedEdits?: boolean } = {},
) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { q: rawQ } = useSearch({ strict: false }) as { q?: string };
  const currentQ = pathname === SEARCH_PATHNAME ? (rawQ ?? "") : "";
  const lastSyncedQRef = useRef(currentQ);

  const form = useForm({
    defaultValues: { q: currentQ },
    onSubmit: ({ value }) => {
      const trimmed = value.q.trim();
      form.reset({ q: trimmed });
      lastSyncedQRef.current = trimmed;
      if (pathname === SEARCH_PATHNAME && trimmed === currentQ) return;
      void navigate({ to: "/search", search: trimmed ? { q: trimmed } : {} });
    },
  });

  useEffect(() => {
    if (currentQ === lastSyncedQRef.current) return;
    const hasUnsyncedEdit = form.state.values.q !== lastSyncedQRef.current;
    if (!preserveUnsyncedEdits || !hasUnsyncedEdit) {
      form.reset({ q: currentQ });
    }
    lastSyncedQRef.current = currentQ;
  }, [currentQ, preserveUnsyncedEdits]);

  return form;
}
