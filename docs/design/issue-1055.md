# 設計書: ヘッダー上で検索文字を入力できるようにしてほしい (#1055)

## 1. 目的 / 背景

現状のヘッダーは虫眼鏡アイコンの `IconButton` のみで、クリックすると `/search` へ遷移してから初めてキーワードを入力できる。Issue 添付画像（Reddit のヘッダー検索欄）が示す「常に検索文字を入力できる」体験に合わせ、ヘッダー上に検索キーワードを直接入力できる入力欄を常設する。

## 2. スコープ（やること / やらないこと）

**やること**

- `AppHeader` の検索アイコンボタンを、検索アイコン付きの常設テキスト入力欄（pill 形状）に置き換える。
- 入力欄で Enter（フォーム送信）すると `/search?q=<キーワード>` へ遷移する（空欄なら `/search` のみ）。
- 現在 `/search` を開いている場合は、ヘッダー入力欄の初期値に現在の `q` を反映する（`SearchScene` 側のフォームと同様、URL の `q` が変わったら追従する）。

**やらないこと**

- `SearchScene.tsx` 内の既存の検索フォーム自体の削除・変更（ページ単体で開いた場合の入力欄としてそのまま残す）。
- 投稿以外（コミュニティ・ワーカー等)の横断検索への拡張。
- インクリメンタルサーチ（入力ごとの自動検索）。既存の `/search` ページと同じく Enter 送信時のみ検索する。

## 3. 受け入れ条件（テストに落とせる粒度）

1. ヘッダーに検索アイコン付きの `textbox`（`aria-label="投稿を検索"`）が常に表示される（`IconButton` ではなくテキスト入力）。
2. 任意のページでヘッダーの検索欄にキーワードを入力し Enter を押すと、`/search?q=<キーワード>` へ遷移し検索結果が表示される。
3. ヘッダーの検索欄で何も入力せず Enter を押すと `/search` へ遷移し、案内テキストが表示される。
4. `/search?q=foo` を開いた状態でヘッダーの検索欄を見ると、初期値に `foo` が入っている。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `client/src/components/AppHeader.tsx` に `HeaderSearchField` という内部コンポーネントを追加する。
- 状態管理は `CLAUDE.md` のフォーム規約に従い `@tanstack/react-form`（`useForm` / `form.Field`）を使う（`SearchScene.tsx` の既存実装と同じパターン）。`useState` による自前管理はしない。
- 現在の `q` の取得は `useSearch({ strict: false })`（`useLoginModal.ts` で使われている既存パターン）で行う。`AppHeader` は全ルートで描画されるため、`/search` 以外のルートでは `q` が `undefined` になる。
- 送信時は `useNavigate()` で `/search` へ `search: trimmed ? { q: trimmed } : {}` を渡して遷移する（`SearchScene.tsx` と同じ組み立て）。
- 見た目は Issue 添付画像（Reddit ヘッダー検索欄）を参照し、`SLACK_COLORS.mainBackground` を背景色にした pill 形状（`borderRadius` はフル pill）とする。これは `CLAUDE.md` の「角丸 16px 以上不使用」という一般則からは逸脱するが、Issue が添付画像通りの見た目を明示的に指示しており、参照 UI として承認済みの「Reddit 風」ヘッダー検索欄を再現するための意図的な例外とする。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client）

- `client/src/components/AppHeader.tsx`: 検索 `IconButton` を `HeaderSearchField` に置き換え。
- `client/src/components/AppHeader.test.tsx`: 新しい入力欄の表示・送信挙動のテストを追加。
- `e2e/search/usecases.md`: UC-SEARCH-01 をヘッダー入力欄からの直接検索に更新。

## 6. テスト計画（TDD で書くテスト一覧）

`client/src/components/AppHeader.test.tsx` に追加:

- ヘッダーに検索用の `textbox`（`aria-label="投稿を検索"`）が表示される。
- 検索欄にキーワードを入力し Enter を押すと `/search?q=<キーワード>` に遷移し検索結果ページの見出しが表示される。
- 検索欄で何も入力せず Enter を押すと `/search` に遷移し案内テキストが表示される。
- `/search?q=foo` を開いた状態でレンダーすると、ヘッダーの検索欄の初期値が `foo` になっている。

## 7. リスク・未決事項

- pill 形状の `borderRadius` はデザインシステムの角丸上限（16px 未満）から逸脱する。Issue 添付画像との一致を優先した意図的な例外として扱う。
- モバイル幅では検索欄がロゴ・右端スロットと同居するため `flex: 1, minWidth: 0` で縮小可能にし、極端な狭幅でも他要素を圧迫しないようにする。専用のモバイルレイアウトテストは追加しない（既存のヘッダー高さ固定テストの範囲でカバー）。

## 8. セルフレビュー反映（`useSearchQueryForm` の同期ロジック修正）

`/code-review` セルフレビューで、`SearchScene.tsx` の検索フォームを共通化した際に導入した `useSearchQueryForm.ts` の URL 追従ロジックに、実際に発生しうる 2 件の不具合が見つかったため修正した。

1. **`isDirty` が「一度きりのフラグ」であることに起因する恒久的な同期停止**: `@tanstack/react-form` の `isDirty` は、一度でも編集すると `reset()` するまで `true` のまま残る（値を defaultValues と同じに戻しても `false` には戻らない）。これをそのまま「未送信の編集がある」の判定に使うと、ヘッダー検索欄で一度でも入力→削除（未送信のまま放棄）すると、以後どのページで `q` の値が変わっても二度と追従しなくなる。
   - **修正**: `isDirty` に頼らず、直前に同期した値を `useRef` で保持し、現在のフィールド値と比較するライブな判定に変更した。
2. **`SearchScene` 自身への同期ガードの誤爆**: ヘッダー用に追加した「未送信の編集中は URL 変化を無視する」ガードを `SearchScene` にもそのまま適用すると、`/search` ページ自身で未送信の編集中にブラウザの戻る/進む（`q` のみが変わる遷移。TanStack Router はコンポーネントを再マウントしない）をすると、表示中の検索結果は新しい `q` に切り替わるのに入力欄だけ古いテキストのまま残り、入力欄と結果が食い違う。
   - **修正**: `useSearchQueryForm` に `preserveUnsyncedEdits`（既定 `false`）を追加し、`AppHeader` は `true`（編集を保持）、`SearchScene` は既定の `false`（常に `q` に追従してリセット。旧 `SearchScene` の挙動を維持）を渡す形に分離した。
3. **`/search` 以外のページでの `q` 漏れ**: `useSearch({ strict: false })` は現在マッチしているルートの search をそのまま返すため、`validateSearch` を持たないルート（`/`, `/communities/$slug`, `/ranking` 等）では URL にたまたま含まれる `q` がそのまま漏れてくる可能性がある。
   - **修正**: `useLocation()` の `pathname` が `/search` のときだけ `q` を読み、それ以外のページでは常に空文字列を使うようにした。

いずれも `client/src/components/AppHeader.test.tsx`（回帰テスト2件追加）と新設 `client/src/routes/SearchScene.test.tsx` でカバーする。
