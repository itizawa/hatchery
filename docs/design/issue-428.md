# 設計書: e2e community エリアの test.todo 実装 (#428)

## 1. 目的 / 背景

`e2e/community/community.spec.ts` に 10 件の `test.todo()` が残っている（Issue 起票時は 7 件、その後追加で 10 件に増加）。  
community 画面（一覧・詳細・購読）は主要画面であり e2e 未カバー。リグレッション検知のため実テストに置き換える。

## 2. スコープ（やること / やらないこと）

**やること**:
- `e2e/community/community.spec.ts` の `test.todo()` 10 件すべてを実テストに置き換える。
- `page.route()` で API をモックし、バックエンドなしでブラウザ側の振る舞いを検証する。

**やらないこと**:
- 他エリアの e2e（post-thread, admin 等）は別 Issue。
- 購読状態のリロード保持（#421 対応状況に依存するため現行挙動前提）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. UC-COMM-01〜10 の全 test.todo が実テスト（`test(title, async ({ page }) => ...)` 形式）で実装されていること。
2. 購読/購読解除テストでは認証済みフィクスチャを使い、未認証との挙動を区別すること。
3. `e2e/support/test.ts` の共通フィクスチャを利用し、テストが実行順に依存しないこと。
4. `pnpm turbo run build test lint` が緑。

## 4. 設計方針

- **モック戦略**: `page.route()` で全 API をインターセプト（認証・コミュニティ・フィード・購読・recent-workers）。
- **API 対応**:
  - `GET /api/auth/me` → 認証状態の切り替え
  - `GET /api/communities` → コミュニティ一覧
  - `GET /api/communities/{slug}/feed` → 投稿一覧
  - `GET /api/communities/{slug}/recent-workers` → 最近のワーカー
  - `GET /api/communities/{slug}/subscription` → 購読状態
  - `POST /api/communities/{slug}/subscribe` → 購読
  - `DELETE /api/communities/{slug}/subscribe` → 購読解除
  - `GET /api/feed` → ホームフィード（サイドバー干渉防止）
- **購読ミューテーション後のリフェッチ**: subscribe/unsubscribe 成功後にサブスクリプションクエリが invalidate されるため、2 回目の GET に異なるレスポンスを返すカウンタ方式でモック。
- **UC-COMM-08（recent-workers 失敗）**: `/api/communities/{slug}/recent-workers` を 500 でモックし、ページ本体が表示されサイドバーに「読み込みに失敗しました」が表示されることを確認。
- **UC-COMM-09（サイドバー開閉）**: ホームページ（`/`）でサイドバーの「コミュニティ」見出しをクリックして Collapse の開閉を検証。
- **UC-COMM-10（共有メニュー）**: clipboard.writeText をページコンテキストで override してコピー成功/失敗の両ケースを検証。

## 5. 影響範囲 / 既存への変更

- **変更対象**: `e2e/community/community.spec.ts`（test.todo → 実テスト置き換え）のみ。
- 他ファイル変更なし（usecases.md の仕様と乖離がある場合は usecases.md を更新）。

## 6. テスト計画（TDD で書くテスト一覧）

| # | テスト | 検証内容 |
|---|--------|----------|
| 01 | UC-COMM-01 | /communities が未ログインで閲覧できる |
| 02 | UC-COMM-02 | 一覧からコミュニティ詳細ページへ遷移できる |
| 03 | UC-COMM-03 | post 一覧・直近ワーカー・作成日・コメント数が表示される |
| 04 | UC-COMM-04 | ログイン済みユーザーが購読できる |
| 05 | UC-COMM-05 | 購読済みコミュニティを解除できる |
| 06 | UC-COMM-06 | 未ログインで購読ボタンが表示されない |
| 07 | UC-COMM-07 | Reddit 風ヘッダーが正しく表示される |
| 08 | UC-COMM-08 | recent-workers 失敗でもページ本体は表示される |
| 09 | UC-COMM-09 | サイドバー「コミュニティ」セクションを開閉できる |
| 10 | UC-COMM-10 | 共有メニューから URL コピーでき失敗時はエラー表示 |

## 7. リスク・未決事項

- UC-COMM-09（サイドバー開閉）: Playwright でモバイルサイズのときサイドバーが非表示になる可能性がある。Desktop Chrome を使うため問題ない想定。
- UC-COMM-10（clipboard コピー失敗）: テスト環境（HTTPS でない）では clipboard API が失敗するが、`page.evaluate` でオーバーライドすることで任意のフィードバックをテストできる。
