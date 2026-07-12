# 設計書: test: client/src/hooks/useSearchQueryForm.ts の同期・リセット分岐のテストを追加する (#1095)

## 1. 目的 / 背景

`client/src/hooks/useSearchQueryForm.ts`（#1055 で新設）は `AppHeader` の常設検索欄と `SearchScene` 本体が共有する検索フォームロジックだが、対応する単体テストが存在しない。兄弟フック `useInstallPrompt.ts` には `useInstallPrompt.test.ts` があるのに非対称であり、以下の意図的に複雑な分岐（コメントで難所と明記されている）がリグレッション検出できない状態にある。

- `/search` 以外のページでは `q` を常に空文字にする
- `preserveUnsyncedEdits` による同期・リセット判定（`isDirty` ではなく `lastSyncedQRef` を使ったライブ比較）
- `onSubmit` のトリム・遷移・遷移抑制ロジック

`AppHeader.test.tsx` / `SearchScene.test.tsx` は統合テストとして一部のシナリオをカバーしているが、フック単体でのロジック検証（本 Issue のスコープ）は行っていない。

## 2. スコープ（やること / やらないこと）

**やること**

- `client/src/hooks/useSearchQueryForm.test.tsx` を新設し、フック単体の同期・リセット・送信分岐をテストする。
- `useSearchQueryForm` は TanStack Router のコンテキスト（`useLocation` / `useNavigate` / `useSearch`）に依存するため、テスト専用の最小ルータ（`rootRoute` + `/`（search param 未検証）+ `/search`（本番と同じ `validateSearch`））を組んで `RouterProvider` 経由でフックをマウントする。

**やらないこと**

- `AppHeader.tsx` / `SearchScene.tsx` の統合テスト追加（既存の `AppHeader.test.tsx` / `SearchScene.test.tsx` でカバー済み・スコープ外）。
- `useSearchQueryForm.ts` 本体の実装変更（挙動不変・テスト追加のみ）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `client/src/hooks/useSearchQueryForm.test.tsx` を新設する（`@testing-library/react` の `render` + テスト専用ルータで `renderHook` 相当を実現）。
2. `/search` 以外のパスでは `q` に URL 上の値があっても `currentQ`（フォーム初期値 `form.state.values.q`）が空文字になることをテストする。
3. `/search` を開いている状態で URL の `q` が変化したとき、
   - `preserveUnsyncedEdits: false`（既定）ではフォーム値がリセットされる
   - `preserveUnsyncedEdits: true` かつ未送信の編集がある場合はリセットされない
   - `preserveUnsyncedEdits: true` でも未送信の編集が無ければリセットされる（分岐の反対側も確認し `!preserveUnsyncedEdits || !hasUnsyncedEdit` の全分岐を保証する）
   をそれぞれテストする。
4. `onSubmit` でトリムされた値を持って `/search` へ `navigate` されること、および `/search` を開いていてトリム後の値が現在の `q` と同じ場合は `navigate` が呼ばれないことをテストする（`router.navigate` を spy して検証）。
5. `pnpm turbo run build|test|lint` が緑であること。フォーム状態管理は `@tanstack/react-form` を使うという既存規約（#262）に沿った実装のままであることを変えない（本 Issue はテスト追加のみで実装は変更しない）。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- テストファイルはフック単体の `client/src/hooks/` 配下に置く（`useInstallPrompt.test.ts` と同じ配置方針）。
- TanStack Router 依存を満たすため、本番の `router.tsx` は使わず、テスト専用の最小 `routeTree`（`rootRoute` → `indexRoute("/")` + `searchRoute("/search", validateSearch: 本番と同じ q 抽出ロジック)`）をテストファイル内に定義する。各ルートの `component` はフックを呼び出し結果をモジュールスコープの ref に格納するだけの `Probe` コンポーネント。
- `createMemoryHistory({ initialEntries: [path] })` + `createRouter` + `RouterProvider` で実際に該当パスにマウントし、`waitFor` でフックの初回結果が `Probe` を通じて反映されるのを待つ。
- ページ遷移（`q` の変化）は `router.navigate({ to, search })` を `act` でラップして起こす。
- `onSubmit` の遷移有無検証は `vi.spyOn(router, "navigate")` で行う（`useNavigate()` は内部で `router.navigate(...)` を呼ぶ実装のため、インスタンスメソッドの spy で捕捉できる）。
- フィールド値の書き換えは既存コードと同じ `form.setFieldValue("q", value)`、送信は `form.handleSubmit()` を使う（`EditCommunityScene.tsx` 等の既存利用パターンに合わせる）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / common / server / docs）

- `client` のみ。新規テストファイル追加と設計書追加のみで、プロダクションコードの変更はない。
- ユーザー可視の振る舞い変更はない（テスト追加のみ）ため `e2e/usecases.md` の更新は不要。

## 6. テスト計画（TDDで書くテスト一覧）

`client/src/hooks/useSearchQueryForm.test.tsx`:

1. `/search` 以外のパス（`/?q=hello`）では `currentQ` が空文字になる
2. `/search?q=foo` → `/search?q=bar` へ遷移、`preserveUnsyncedEdits` 未指定（既定 false）でフォーム値がリセットされる
3. `/search?q=foo` → `/search?q=bar` へ遷移、`preserveUnsyncedEdits: true` かつ未送信の編集がある場合はリセットされない
4. `/search?q=foo` → `/search?q=bar` へ遷移、`preserveUnsyncedEdits: true` だが未送信の編集が無い場合はリセットされる
5. `/`（非 `/search`）でフィールドに前後空白付きの値を入力して送信すると、トリムされた値で `/search` へ `navigate` される
6. `/search?q=cats` でフィールド値を変更せず送信すると `navigate` が呼ばれない

## 7. リスク・未決事項

- テスト専用ルータの `validateSearch` は本番 `router.tsx` の `searchRoute.validateSearch` と重複定義になる（本番ルートを import して再利用する設計も検討したが、`router.tsx` は多数の遅延 import・認証ガードを持つモジュールでありテストが不必要に重くなるため、フックが依存する範囲だけを持つ最小ルータを独自定義する方針を採用）。将来 `searchRoute.validateSearch` の抽出・共有関数化が行われた場合はテスト側もそれを import するよう追従が望ましい（本 Issue のスコープ外）。
