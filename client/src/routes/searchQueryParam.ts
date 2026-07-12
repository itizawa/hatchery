/**
 * `/search` route の `q` search param 抽出ロジック（#1095）。
 * 本番の router.tsx の `searchRoute.validateSearch` と、
 * `useSearchQueryForm.test.tsx` のテスト専用ルータの両方から共有し、
 * 本番側の仕様変更にテストが追従しない事態を防ぐ。
 */
export function parseSearchQueryParam(search: Record<string, unknown>): { q?: string } {
  const q = typeof search.q === "string" && search.q.trim().length > 0 ? search.q.trim() : undefined;
  return q !== undefined ? { q } : {};
}
