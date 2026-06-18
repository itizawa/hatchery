# Hatchery Admin MCP Server

Hatchery の Admin REST API を MCP ツールとしてラップするサーバーです。Claude Code から MCP ツール呼び出しだけでワーカー・コミュニティの CRUD が行えます。DB URL や API 認証情報を会話に渡す必要がなくなります。

## 提供するツール

| ツール名 | 説明 |
|---------|------|
| `list_workers` | ワーカー一覧を取得する |
| `create_worker` | 新しいワーカーを作成する |
| `update_worker` | ワーカーを更新する |
| `list_communities` | コミュニティ一覧を取得する |
| `create_community` | 新しいコミュニティを作成する |
| `update_community` | コミュニティを更新する |
| `assign_worker_to_community` | ワーカーの所属コミュニティを設定する |

## セットアップ手順

### 1. ビルド

```bash
pnpm --filter @hatchery/mcp build
```

### 2. 環境変数の準備

| 環境変数 | 説明 | 例 |
|---------|------|----||
| `HATCHERY_API_BASE_URL` | Hatchery の API ベース URL | `https://hatchery-works.com` |
| `HATCHERY_ADMIN_TOKEN` | admin 認証用 Bearer トークン（後述） |  |

### 3. HATCHERY_ADMIN_TOKEN の取得方法

`HATCHERY_ADMIN_TOKEN` は **サーバー側の環境変数** でも同じ値を設定する必要があります。

1. 安全なランダム文字列を生成します:
   ```bash
   openssl rand -hex 32
   ```

2. 生成した文字列を **Hatchery サーバー側** の環境変数に設定します:
   ```
   HATCHERY_ADMIN_TOKEN=<生成した文字列>
   ```

3. 同じ文字列を MCP Server の環境変数にも設定します（後述の Claude Code 設定）。

> **セキュリティ注意**: `HATCHERY_ADMIN_TOKEN` は admin 権限を持つ秘密情報です。会話ログ・バージョン管理・公開リポジトリには絶対に含めないでください。

### 4. Claude Code への登録

プロジェクトルートの `.mcp.json` に以下のエントリが追加されています（ビルド後に使用可能）:

```json
{
  "mcpServers": {
    "hatchery-admin": {
      "command": "node",
      "args": ["./mcp/dist/index.js"],
      "env": {
        "HATCHERY_API_BASE_URL": "https://hatchery-works.com",
        "HATCHERY_ADMIN_TOKEN": "<あなたのトークン>"
      }
    }
  }
}
```

`.mcp.json` の `HATCHERY_API_BASE_URL` と `HATCHERY_ADMIN_TOKEN` を実際の値に書き換えてください。

### 5. 動作確認

Claude Code を再起動後、以下のように使用できます:

```
list_workers ツールでワーカー一覧を表示してください
```

## ローカル開発

```bash
# 依存関係のインストール
pnpm install

# ビルド
pnpm --filter @hatchery/mcp build

# テスト
pnpm --filter @hatchery/mcp test

# lint
pnpm --filter @hatchery/mcp lint
```
