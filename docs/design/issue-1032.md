# 設計書: test: mcp/src/index.ts の update_worker バリデーション分岐をテスト可能な形に抽出しテストを追加する (#1032)

## 1. 目的 / 背景

`mcp/src/index.ts`（Hatchery Admin MCP Server のエントリポイント、#603）には `mcp/src/apiClient.ts` 用のテスト（`apiClient.test.ts`）は存在するが、`index.ts` 自体には一切テストが無い。`update_worker` ツールハンドラ（L55-62 付近）には、更新対象フィールドが1つも指定されなかった場合にエラーを投げる実ロジックが存在するが、`McpServer` への登録・`StdioServerTransport` 接続込みでしか呼び出せない構造のためテスト不可能になっている。この分岐ロジックを純粋関数として切り出し、単体テストで壊れないことを保証する。

## 2. スコープ（やること / やらないこと）

### やること

- `mcp/src/` 配下に、更新対象フィールドが1つも指定されていないかを判定する純粋関数 `hasNoUpdateFields` を新設する。
- `index.ts` の `update_worker` ハンドラをこの関数を呼び出す形にリファクタリングする（外部からの見た目の挙動は変えない）。
- 新設した関数の単体テストを追加する。

### やらないこと

- `create_worker` / `create_community` 等、バリデーション分岐を持たない他のツールハンドラへのテスト追加（Issue 本文で明示的にスコープ外）。
- `update_worker` の他の振る舞い（API 呼び出し自体・エラーメッセージ文言）の変更。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `hasNoUpdateFields({ displayName, role, personality, verbosity }): boolean` が `mcp/src/` に存在する。
2. `index.ts` の `update_worker` ハンドラがこの関数を呼び出す形にリファクタリングされている（挙動は不変）。
3. 単体テストで以下を検証する:
   - 全フィールド未指定（すべて `undefined`）→ `true` を返す。
   - `displayName` のみ指定 → `false` を返す。
   - `role` のみ指定 → `false` を返す。
   - `personality` のみ指定 → `false` を返す。
   - `verbosity` のみ指定 → `false` を返す。
   - 複数フィールドの組み合わせ指定（例: `displayName` + `role`）→ `false` を返す。
4. `pnpm turbo run build|test|lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `mcp/src/updateWorkerValidation.ts` に純粋関数 `hasNoUpdateFields` を新設する。引数はオブジェクト引数（`CLAUDE.md` 関数引数規約）。
  ```ts
  export function hasNoUpdateFields({
    displayName,
    role,
    personality,
    verbosity,
  }: {
    displayName: string | undefined;
    role: string | undefined;
    personality: string | undefined;
    verbosity: string | undefined;
  }): boolean {
    return (
      displayName === undefined &&
      role === undefined &&
      personality === undefined &&
      verbosity === undefined
    );
  }
  ```
- `index.ts` の `update_worker` ハンドラ内の条件式をこの関数呼び出しに置き換える。
- `mcp/` は `common` に依存しない独立ワークスペースであるため（`mcp/package.json` に `@hatchery/common` 依存なし）、この関数は `mcp/src/` 内に置く。共有ドメインロジックではなく MCP サーバー固有の入力検証のため、`common/` への配置は不要。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: mcp）

- 対象ワークスペース: `mcp` のみ。`client` / `server` / `common` への影響なし。
- ユーザー可視の振る舞い変更なし（MCP サーバーの内部リファクタ + テスト追加）。

## 6. テスト計画（TDDで書くテスト一覧）

- `mcp/src/updateWorkerValidation.test.ts`（新規）
  - `hasNoUpdateFields`:
    - 全フィールド未指定 → `true`
    - `displayName` のみ → `false`
    - `role` のみ → `false`
    - `personality` のみ → `false`
    - `verbosity` のみ → `false`
    - 複数指定の組み合わせ → `false`

## 7. リスク・未決事項

- 特になし。純粋関数の切り出し + テスト追加のみで、外部インターフェース・DB・API 呼び出しへの影響はない。
- ユーザー可視の振る舞いが変わらないため、e2e ユースケース（`e2e/usecases.md`）の更新は不要。
