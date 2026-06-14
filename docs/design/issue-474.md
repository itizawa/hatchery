# Issue #474: クリップボードコピー失敗時のフィードバック（ShareButton）

## 背景

クリップボードコピー処理が失敗を silent catch しており、ユーザーにフィードバックを出さない。HTTP（非セキュアコンテキスト）や権限拒否で `navigator.clipboard` が使えない環境では、コピーされていないのに成功と区別が付かず、ユーザーが古い/空の内容を貼り付ける事故につながる。

## スコープの確定

Issue では `ShareButton.tsx` と `InvitationsTab.tsx` の 2 箇所が対象として挙げられていたが、`InvitationsTab.tsx` は #455（`add0a04 feat: #455 招待関連ファイルを削除`、develop に取り込み済み）で**削除済み**。したがって本対応のスコープは `ShareButton.tsx` のみとする。

## 受け入れ条件 → 入出力

| # | 受け入れ条件 | 実装 / テスト |
|---|---|---|
| 1 | コピー失敗時にエラー Snackbar 等で「コピーに失敗しました」を表示し成功と区別できる | `handleCopy` の catch でエラー状態を立て、エラー Snackbar（severity="error"）を表示。「URL のコピーに失敗しました」 |
| 2 | 手動コピー用フォールバック（任意） | 今回はエラー Snackbar 内に対象 URL をテキスト表示して手動選択可能にする |
| 3 | 成功時の挙動を退行させない | 既存の成功 Snackbar を維持。テスト既存ケースが緑のまま |
| 4 | RTL テストに reject 時のエラー表示ケースを追加 | `ShareButton.test.tsx` に「writeText が reject するとエラー表示が出る」を追加 |
| 5 | `pnpm turbo run build test lint` が緑 | CI で担保 |

## 設計判断

- 成功 / 失敗をそれぞれ別 Snackbar として持つのではなく、`snackbar` 状態を `{ open: boolean; severity: "success" | "error" }` 形式で 1 つにまとめ、severity・メッセージを切り替える。状態管理を単純化し、成功と失敗が同時に出ないようにする。
- 失敗時のメッセージは「URL のコピーに失敗しました」とし、フォールバックとして対象 URL をユーザーが手動選択できるよう Snackbar 本文にプレーンテキストで併記する（受け入れ条件 2 の任意フォールバック）。
- フォーム要素は無いため `@tanstack/react-form` は不要。Zod `.max()` 対象のユーザー入力フィールドも無い。
- ユーザー可視の振る舞い（コピー失敗時のエラー表示）が増えるため、`e2e/` のシェア導線ユースケースを更新する。

## テスト計画（client / RTL）

- 既存ケース（共有ボタン表示・メニュー・成功 writeText・成功 Snackbar・X シェア）は維持。
- 追加: `navigator.clipboard.writeText` が reject すると「URL のコピーに失敗しました」が表示される。
- 追加: 失敗時に成功 Snackbar（「URL をコピーしました」）は表示されない。
