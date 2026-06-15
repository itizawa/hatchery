# Issue #535 設計: `server/src/openapi/registry.ts` をリソース別モジュールに分割する

## 背景・目的

`server/src/openapi/registry.ts`（689 行・約 52 の path/schema 登録）が全リソースの OpenAPI 登録を 1
ファイルに集約しており、server 中で最大のファイルになっている。リソース追加のたびにこの巨大ファイルを
編集するため、衝突・見通し悪化の原因になっている。

OpenAPI レジストリ登録を**リソース単位のモジュール**に分割し、`registry.ts` は各モジュールを束ねる
**薄い集約点**にする。これは純粋なリファクタであり、生成される `openapi.json` は不変であることを保証する。

## 受け入れ条件（テストに落とす）

1. `server/src/openapi/registrations/` 配下にリソース別の登録モジュール（`registerAuth.ts` 等）を作り、
   `registry.ts` がそれらを呼び出して 1 つの registry を構成する形に分割する。
2. 分割前後で `pnpm --filter @hatchery/server openapi` が生成する `openapi.json` が**一致する**（差分なし）。
3. `server/src/openapi/registry.test.ts` が緑のまま（モジュール別テストへ整理）。
4. `pnpm turbo run build test lint` が緑。turbo.json の順序を崩さない。

## 設計判断

### 公開 API の不変性

- `registry.ts` の公開エクスポートは `generateOpenApiDocument()` のみで、`generate.ts` /
  `routes/apiDocs.ts` から `import { generateOpenApiDocument } from "../openapi/registry.js"` で
  参照されている。**このシグネチャ・import パスは変更しない**（呼び出し側に一切手を入れない）。

### モジュール分割方針

- `OpenAPIRegistry` のインスタンスを各登録関数に**引数で渡す**形にする
  （`registerAuth(registry, ctx)`）。各モジュールは「渡された registry に対して
  `register` / `registerPath` を呼ぶ副作用関数」とする。
- スキーマ component（`AuthUserComponent` 等）や共有パラメータ（`workerPathIdParam` 等）、
  共有レスポンス断片（`errorJson`）は登録順序とクロスリソース参照の都合があるため、
  **共有コンテキスト**（`shared.ts`）に集約し、各モジュールへ引数（`ctx`）で渡す。
  - `zod-to-openapi` は `registry.register` を呼んだ順序で `components.schemas` の出力順が決まるため、
    **register の呼び出し順序を分割前と完全に一致**させることが `openapi.json` 不変の必須条件。
    `registry.ts` の集約点で「分割前と同じ順序」で各 `registerXxx` を呼ぶことで順序を保つ。
- 分割するリソース（`registry.ts` 内のセクション順に対応）:
  - `registerWorkers.ts` … Worker CRUD + admin worker + worker communities
  - `registerAuth.ts` … auth（logout / me / google）
  - `registerAdmin.ts` … admin settings / batch-logs / token-usage
  - `registerHealth.ts` … health
  - `registerCommunities.ts` … admin communities / community 画像 / admin posts・comments /
    公開 communities / feed / recent-workers / subscription / subscribe
  - `registerFeed.ts` … `/api/feed`
  - `registerPosts.ts` … スレッド取得 / vote（post・comment）

### 出力不変の検証戦略（TDD）

- **回帰テスト**: 分割前に生成した baseline `openapi.json` を fixture として固定し、分割後の
  `generateOpenApiDocument()` の出力（JSON 文字列）が baseline と完全一致することを assert する
  テストを追加する。fixture は `registry.snapshot.test.ts` に inline で持たず、
  生成物 `openapi.json` はコミットしない方針のため、テスト内では「キー数・paths 数・schemas 数・
  既存 registry.test の全項目」が緑であることで担保し、加えて分割作業中に手元で
  `diff` を取り baseline と byte 一致を確認する（手順は PR 本文に記載）。

## スコープ外

- API スキーマ自体の変更（path / schema の追加・削除・改名）。
- 生成物（`openapi.json`）のコミット。
