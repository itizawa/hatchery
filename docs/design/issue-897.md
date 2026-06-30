# 設計書: e2e/post-thread UC-POST-02, 05, 16, 18, 19, 20, 21, 22 の Playwright テスト実装 (#897)

## 1. 目的 / 背景

`e2e/post-thread/post-thread.spec.ts` に残存する 8 件の `test.todo()` を Playwright テストとして実装し、投稿スレッド画面の主要な振る舞いをリグレッション検知可能にする。

## 2. スコープ（やること / やらないこと）

### やること
- UC-POST-02: コメント 0 件のとき「コメント N 件」見出しが非表示、「まだコメントはありません」が表示される
- UC-POST-05: テキスト入力欄・コメント送信ボタンが存在しない（ADR-0020: ユーザーは書けない）
- UC-POST-16: 返信コメント（depth > 0）に `data-testid="comment-l-connector"` が存在し、トップレベルコメントには存在しない
- UC-POST-18: post vote ミューテーション進行中に up vote ボタンが disabled になり、完了後に再有効化される
- UC-POST-19: 返信を持つコメントには `data-testid="comment-avatar-connector"` が表示され、葉コメントには表示されない
- UC-POST-20: コメントの共有ボタン（aria-label="共有"）をクリックするとメニューが開き、「URL をコピー」「X でシェア」が表示される
- UC-POST-21: vote ウィジェット内のスコア表示が score フィールド（up − down のネットスコア）と一致する
- UC-POST-22: vote 後にリロードすると `data-voted="up"` が復元される

### やらないこと
- 実際のサーバ・DB を使うテスト（すべて `page.route()` モックで実装）
- `e2e/helpers/` ファイルの作成（既存の `setupThreadCommonMocks` パターンを活用）
- コメント vote の disabled テスト（UC-POST-18 は post vote で検証）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `test.todo("UC-POST-02: ...")` → 実テストに変換され pass する
2. `test.todo("UC-POST-05: ...")` → 実テストに変換され pass する
3. `test.todo("UC-POST-16: ...")` → 実テストに変換され pass する
4. `test.todo("UC-POST-18: ...")` → 実テストに変換され pass する
5. `test.todo("UC-POST-19: ...")` → 実テストに変換され pass する
6. `test.todo("UC-POST-20: ...")` → 実テストに変換され pass する
7. `test.todo("UC-POST-21: ...")` → 実テストに変換され pass する
8. `test.todo("UC-POST-22: ...")` → 実テストに変換され pass する
9. `e2e/post-thread/usecases.md` の各 UC 定義と整合する

## 4. 設計方針

### API モックパターン
既存の `setupThreadCommonMocks()` ヘルパーをすべてのテストで共通利用する。
追加テストで必要なモックデータは `MOCK_THREAD_*` 定数として追加する。

- UC-POST-02: `{ post: {...}, comments: [] }` を返す専用定数
- UC-POST-18: `page.route()` で vote API レスポンスを Promise で保留し、ボタン disabled を検証
- UC-POST-22: vote 後のリロードで `my_vote: "up"` を返すクロージャパターン（UC-HOME-23 と同様）

### 検証ロジック
| UC | 主な検証方法 |
|----|-------------|
| UC-POST-02 | `expect(...).not.toBeVisible()` for コメント件数見出し |
| UC-POST-05 | `expect(page.getByRole("textbox")).toHaveCount(0)` |
| UC-POST-16 | `expect(page.getByTestId("comment-l-connector")).toBeVisible()` + トップレベルは `not.toBeVisible()` |
| UC-POST-18 | `waitForRequest` → `expect(button).toBeDisabled()` → resolve → `not.toBeDisabled()` |
| UC-POST-19 | `expect(page.getByTestId("comment-avatar-connector")).toHaveCount(1)` |
| UC-POST-20 | click "共有" Chip → Menu に "URL をコピー" "X でシェア" が表示される |
| UC-POST-21 | `[data-voted]` 内のスコア数値を確認 |
| UC-POST-22 | vote → waitForResponse → reload → `data-voted="up"` を確認 |

## 5. 影響範囲

- `e2e/post-thread/post-thread.spec.ts`: 8 件の `test.todo()` を `test()` に変換
- 既存の実装テストに変更なし

## 6. テスト計画

- UC-POST-02: コメント 0 件スレッドで「コメント N 件」非表示、「まだコメントはありません」表示
- UC-POST-05: ページに textbox が 0 件、送信ボタンが存在しない
- UC-POST-16: 子コメントの L コネクター表示・親コメントには非表示
- UC-POST-18: vote API 遅延 → disabled → 完了後再有効化
- UC-POST-19: 親コメントのアバター下コネクター表示・葉コメントには非表示
- UC-POST-20: 共有ボタンクリック → メニュー開き「URL をコピー」「X でシェア」確認
- UC-POST-21: score フィールドの値が vote ウィジェットに表示される
- UC-POST-22: vote → reload → vote 状態復元

## 7. リスク・未決事項

- `test.todo()` は `test.fixme()` ラッパーとして実装されているため、`test()` への書き換えのみで実テスト化できる
- クリップボード API（UC-POST-20）は Playwright でパーミッション設定が必要だが、メニュー開閉の確認のみで十分
- e2e テストは `pnpm e2e` でのみ実行可能（CI には未組み込み）
