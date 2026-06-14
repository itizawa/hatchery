# 設計書: e2e auth エリアの test.todo 7 件を実装する (#426)

## 1. 目的 / 背景

`e2e/auth/auth.spec.ts` に `test.todo()` として定義された 7 件のスケルトンを実テストに置き換え、
認証導線のリグレッションを e2e で検知できるようにする（#393 フォローアップ）。

## 2. スコープ（やること / やらないこと）

**やること**:
- `e2e/auth/auth.spec.ts` の `test.todo()` 7 件を `test()` に置き換えて実テストを実装する
- `page.route()` で API をモックしてバックエンドなしでテスト可能にする

**やらないこと**:
- 実際の Google OAuth フローのテスト（バックエンドが必要なため。サーバー側動作はモックで代替）
- CI への e2e 組み込み（別 Issue 対応）
- 他エリア（home-feed / community 等）の test.todo 実装

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `e2e/auth/auth.spec.ts` の `test.todo()` 7 件すべてが、`e2e/auth/usecases.md` の受け入れ観点に沿った実テストとして実装されていること
2. `page.route()` で `/api/auth/me`・`/api/communities`・`/api/feed` をモックし、バックエンド不要でテストが動くこと
3. ローカルで `pnpm exec playwright test e2e/auth` が安定して緑であること（flaky な wait を含まない）
4. `pnpm turbo run build test lint` が緑（e2e は CI 対象外のため本条件には含まない）

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### API モック戦略

Playwright の `page.route()` を用いて以下 API をモックする:

| API | 未認証モック | 認証済みモック |
|-----|------------|---------------|
| `GET /api/auth/me` | 401 | 200 + MOCK_USER |
| `GET /api/communities` | 200 + `[]` | 200 + `[]` |
| `GET /api/feed*` | 200 + `{posts:[], nextCursor:null}` | 200 + `{posts:[], nextCursor:null}` |
| `GET /api/auth/google` | （UC-AUTH-02 のみ）200 + mock HTML | — |
| `**/api/auth/google/callback*` | — | （UC-AUTH-03 のみ）302 → `/` |
| `POST /api/auth/logout` | — | （UC-AUTH-04 のみ）200 |

### MOCK_USER の構造

```json
{ "id": "test-user-1", "email": "test@example.com", "displayName": "テスト太郎", "role": "member" }
```

### ヘルパー関数

テストファイル内ローカルのヘルパー関数（`support/test.ts` は変更しない）:
- `mockUnauthenticated(page)`: `/api/auth/me` → 401
- `mockAuthenticated(page)`: `/api/auth/me` → 200 + MOCK_USER
- `mockContentApis(page)`: コンテンツ API をすべて空レスポンスにしてサイドバー・フィード取得エラーを防ぐ

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / docs）

- **`e2e/auth/auth.spec.ts`**: `test.todo()` → `test()` に置き換え（唯一の変更ファイル）
- `e2e/support/test.ts`・`e2e/auth/usecases.md`・その他: 変更なし
- `client/`・`server/`・`common/`: 変更なし

## 6. テスト計画（TDDで書くテスト一覧）

| テスト ID | 説明 | モック |
|----------|------|--------|
| UC-AUTH-01 | ヘッダーの「ログイン」リンクをクリック → モーダルが開く | auth=401, content=空 |
| UC-AUTH-02 | モーダルの「Google でログイン」クリック → `/api/auth/google` へ遷移 | auth=401, google=200 mock |
| UC-AUTH-03 | OAuth コールバック → `/` へリダイレクト → ログイン済み状態 | auth=MOCK_USER, callback=302→/ |
| UC-AUTH-04 | ログアウト → ゲスト状態 → モーダル自動不開 | auth=MOCK_USER→401, logout=200 |
| UC-AUTH-05 | 未認証で `/account` → `/?login=1` リダイレクト → モーダル開 | auth=401 |
| UC-AUTH-06 | 未認証で `/admin` → `/?login=1` リダイレクト → モーダル開 | auth=401 |
| UC-AUTH-07 | `/login` → `/?login=1` → モーダル開（後方互換） | auth=401 |

## 7. リスク・未決事項

- UC-AUTH-03: OAuth コールバックはバックエンドが処理するため、実装の正確な挙動はバックエンドテストに委ねる。e2e ではブラウザ側の「リダイレクト後の状態」を検証する。
- UC-AUTH-04: `queryClient.setQueryData(AUTH_ME_QUERY_KEY, null)` でキャッシュを直接更新するため `/api/auth/me` の再フェッチは発生しない（staleTime: 60_000）。Playwright ルートモックの再利用で安全に動作する。
- Playwright の e2e テストは CI（`pnpm turbo run test`）に組み込まれていないため、PR マージ判定は `pnpm turbo run build test lint`（Vitest/ESLint のみ）で行う。
