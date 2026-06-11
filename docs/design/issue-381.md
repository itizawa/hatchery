# 設計書: Issue #381 — CommunitiesTab の RTL テストを追加する

## 背景 / 目的

`client/src/components/CommunitiesTab.tsx`（管理画面のコミュニティ作成・編集フォーム、#310）は
admin 系コンポーネントの中で最大級でありながら対応するテストを持たない。
`useForm`（@tanstack/react-form）によるバリデーションと作成・更新 mutation の呼び出しを
RTL + MSW で回帰検証できるようにする。

本 Issue は **テスト追加のみ**（プロダクトコードの変更なし）。
テストは対象コードの現仕様を表現するものとして書き、緑であることを確認して完結する。

## テスト方式の選定

- **MSW（msw/node の `setupServer`）でコミュニティ API をモックする**。
  既存の `client/src/mocks/handlers.test.ts` が同方式を採用しており、Issue の受け入れ条件
  「MSW でコミュニティ API をモック」「ネットワーク実アクセスをしない」をそのまま満たす。
  `server.listen({ onUnhandledRequest: "error" })` により取りこぼしリクエストを検知する。
- テストファイル内にテスト専用ハンドラ（GET/POST `/api/admin/communities`、
  PATCH `/api/admin/communities/:id`）を定義し、POST/PATCH の受信 body を記録して
  「mutation が正しい body で呼ばれたこと」を HTTP 境界で検証する
  （フックの内部実装に依存せず、openapi-fetch 経由の実リクエストを検証できる）。
- レンダリングは既存テスト（`AddWorkerDialog.test.tsx` 等）と同じく
  `QueryClientProvider`（retry: false）でラップする。

## 検証項目（受け入れ条件 → テストケース）

| # | 受け入れ条件 | テストケース |
|---|--------------|--------------|
| 1-a | 必須項目が空のまま送信するとバリデーションエラー表示・mutation は呼ばれない | 空のまま「作成」→ 「slug は必須です」「コミュニティ名は必須です」「作風の説明は必須です」が表示され、POST が 1 回も飛ばない |
| 1-a' | slug 形式バリデーション | 不正 slug（大文字等）で送信 → 形式エラーが表示され POST が飛ばない |
| 1-b | 有効入力で作成 mutation が正しい body で呼ばれ成功スナックバー表示 | slug/name/description を入力し「作成」→ POST body が入力値と一致・「コミュニティを作成しました」表示・フォームがリセットされる |
| 1-b' | 409 時のエラー表示（現仕様） | POST が 409 を返す → 「この slug はすでに使用されています」が表示される |
| 1-c | 編集フォームで既存値が初期表示され更新 mutation が呼ばれる | 「編集」クリック → name/description が既存値で表示 → 変更して「保存」→ PATCH `/:id` が変更後 body で呼ばれ、行表示に戻る |
| 2 | `inputProps={{ maxLength }}` が Zod `.max()` と整合 | 作成フォームの slug/name/description と編集フォームの name/description の `maxlength` 属性が common の `COMMUNITY_*_MAX_LENGTH` 定数と一致する |
| 3 | 既存 RTL + MSW セットアップ利用・実ネットワークなし | msw/node `setupServer` + `onUnhandledRequest: "error"` |
| 4 | build/test/lint 緑・import 境界遵守 | client → common（定数）/ client 内 import のみ |

付帯的に一覧表示（GET 結果のテーブル描画）も編集テストの前提として検証される。

## スコープ外

- コミュニティ一覧の並び替え・削除などフォーム外の挙動
- プロダクトコード（CommunitiesTab.tsx / api/communities.ts / common スキーマ）の変更
