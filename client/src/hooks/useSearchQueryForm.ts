import { useForm } from "@tanstack/react-form";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * `/search` の `q` を扱う検索フォーム共通ロジック（#1055）。
 * ヘッダー常設検索欄（`AppHeader`）とページ本体（`SearchScene`）の双方が同じ
 * 「現在の q を初期値にし、送信でトリムした q を持って /search へ遷移する」挙動を共有する。
 *
 * `AppHeader` はルート跨ぎで再マウントされないため、ルートの `q` が変わったら追従する
 * `useEffect` を持つ。ただしユーザーが未送信の編集中（`isDirty`）の間は追従で上書きしない
 * （編集途中に別ページへ遷移しても入力内容を失わないため）。
 */
export function useSearchQueryForm() {
  const navigate = useNavigate();
  const { q: currentQ = "" } = useSearch({ strict: false }) as { q?: string };

  const form = useForm({
    defaultValues: { q: currentQ },
    onSubmit: ({ value }) => {
      const trimmed = value.q.trim();
      form.reset({ q: trimmed });
      void navigate({ to: "/search", search: trimmed ? { q: trimmed } : {} });
    },
  });

  useEffect(() => {
    if (form.state.isDirty) return;
    void form.reset({ q: currentQ });
  }, [currentQ]);

  return form;
}
