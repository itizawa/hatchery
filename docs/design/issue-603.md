# 設計書: Hatchery Admin MCP Server 構築 (#603)

## 1. 目的 / 背景

Claude がワーカー追加・コミュニティ追加などの管理作業を行う際、ユーザーが毎回本番 DB の接続 URL（認証情報付き）を会話に貼って渡している。これにより生の認証情報が会話ログに残るセキュリティリスクがある。

既存の Admin REST API を MCP Server でラップすることで、DB URL も API 認証情報も Claude の会話に出さずに管理操作が行えるようにする。

## 2. スコープ（やること / やらないこと）

**やること:**
- `mcp/` ディレクトリに Hatchery Admin MCP Server を実装する（`@hatchery/mcp` workspace）
- 7 つの MCP ツールを提供する（list_workers, create_worker, update_worker, list_communities, create_community, update_community, assign_worker_to_community）
- `server/` の Admin API に Bearer トークン認証を追加する（`requireAdminAccess` ミドルウェア）
- `.claude/settings.json` に MCP Server エントリを追加する
- `mcp/README.md` にセットアップ手順を記載する

**やらないこと:**
- 画像アップロード MCP ツール（adminWorkerImage, adminCommunityImage）
- バッチログ閲覧・settings 変更 MCP ツール
- DB への直接接続

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `requireAdminAccess` ミドルウェアが `Authorization: Bearer <HATCHERY_ADMIN_TOKEN>` を受け付け、一致すれば 200 を返す
2. `requireAdminAccess` ミドルウェアがトークン不一致・未認証のときに 401 を返す
3. `requireAdminAccess` ミドルウェアが session 認証（admin ユーザー）でも 200 を返す
4. `requireAdminAccess` ミドルウェアが session 認証（member ユーザー）で 403 を返す
5. MCP の `apiClient` が各エンドポイントへ正しい HTTP メソッド・パス・ヘッダーでリクエストを送る
6. MCP の `apiClient` が API エラー時に `Error` を投げる
7. `pnpm turbo run build lint` が緑

## 4. 設計方針

### 4-1. Bearer トークン認証（server 側）

既存の `requireAuth + requireAdmin` チェーンを置き換える `requireAdminAccess` ミドルウェアを新設する。

```
Authorization: Bearer <HATCHERY_ADMIN_TOKEN> が一致 → 認可
└ 不一致 or ヘッダー無し → session auth にフォールバック
    ├ req.isAuthenticated() && isAdmin(req.user) → 認可
    ├ req.isAuthenticated() && !isAdmin(req.user) → 403
    └ !req.isAuthenticated() → 401
```

サーバー側で `HATCHERY_ADMIN_TOKEN` を環境変数として保持する。トークンが未設定の場合は Bearer トークンチェックをスキップして session auth のみに従う。

### 4-2. MCP Server アーキテクチャ

`mcp/src/apiClient.ts` に HTTP 呼び出しロジックを集約し、単体テストを可能にする。
`mcp/src/index.ts` は MCP プロセスのエントリポイントとし、`McpServer` ツール登録と transport 接続を担う。

```
mcp/src/index.ts      → McpServer + StdioServerTransport（MCP プロトコル）
mcp/src/apiClient.ts  → fetch ベースの HTTP クライアント（テスト可能）
```

### 4-3. 環境変数

| 変数名 | 役割 |
|--------|------|
| `HATCHERY_API_BASE_URL` | MCP Server が呼び出す API ベース URL（例: `https://hatchery-works.com`） |
| `HATCHERY_ADMIN_TOKEN` | Bearer トークン。Server/MCP 両方が同じ値を参照する |

### 4-4. workspace 追加

- `pnpm-workspace.yaml` に `mcp` を追加
- Turborepo の `build`/`lint`/`test` タスクが自動的に `@hatchery/mcp` も対象に含む

## 5. 影響範囲 / 既存への変更

| 対象 | 変更内容 |
|------|----------|
| `server/src/middleware/requireAdminAccess.ts` | 新規作成（Bearer token + session auth） |
| `server/src/routes/admin.ts` | `requireAuth, requireAdmin` → `requireAdminAccess` に変更 |
| `server/src/routes/adminWorkerCommunities.ts` | 同上 |
| `server/src/routes/workers.ts` | PATCH route の `requireAuth, requireAdmin` → `requireAdminAccess` |
| `mcp/` | 新規 workspace（package.json, tsconfig.json, src/, README.md） |
| `pnpm-workspace.yaml` | `mcp` を追加 |
| `.claude/settings.json` | `mcpServers` エントリを追加 |

## 6. テスト計画

### server 側
- `requireAdminAccess.test.ts`
  - Bearer token 正解 → 200（next() 呼び出し）
  - Bearer token 不正解 → session auth フォールバック → 401（未認証）
  - HATCHERY_ADMIN_TOKEN 未設定 → Bearer token 無視 → session auth
  - session admin → 200
  - session member → 403
  - 未認証 → 401

### mcp 側
- `apiClient.test.ts`
  - 各ツール関数が正しい URL・メソッド・ヘッダー・ボディで fetch を呼ぶ
  - API エラー（4xx/5xx）時に Error を投げる

## 7. リスク・未決事項

- `HATCHERY_ADMIN_TOKEN` の値管理: 本番では安全な秘密管理（環境変数 / Secrets Manager）が必要。README に注意を記載する。
- `@modelcontextprotocol/sdk` の API バージョン: v1.29.0 で実装する。
