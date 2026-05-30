# ADR-0006: client ↔ server の型共有（OpenAPI + openapi-typescript）

- ステータス: Accepted
- 日付: 2026-05-30
- 関連 Issue: #1

## コンテキスト（背景）

client と server は同じ monorepo にあるが、API の境界（HTTP）を越えてやり取りする。ここで型がずれると、画面が壊れたり実行時エラーになる。Issue #1 で client 側に **openapi-typescript** の採用が示されている。型・検証・ドキュメントの単一情報源をどう作り、どう client に流すかを決める。

## 決定

**OpenAPI を境界の単一情報源とし、server で生成 → client で型を生成する一方向フローを採用する。**

```
common: Zod スキーマ（req/res 定義・ドメイン検証）
   │  （server が import）
   ▼
server: ルート定義 + zod-to-openapi で openapi.json を生成
   │  （生成物をリポジトリに出力）
   ▼
client: openapi-typescript で openapi.json → 型(.d.ts) を生成
   │
   ▼
client: openapi-fetch（型安全 fetch） + TanStack Query で利用
```

- **スキーマ定義**: `common` の Zod スキーマを単一情報源にする（ADR-0005）。server はこれを使ってリクエスト検証も行う。
- **OpenAPI 生成**: server で `@asteasolutions/zod-to-openapi` を使い、Zod スキーマ + ルート情報から `openapi.json` を生成する（生成スクリプトを用意）。
- **client 型生成**: `openapi-typescript` で `openapi.json` から型を生成する。生成物はコミットせず（`.gitignore`、ADR-0002 の `*.gen.ts` / `generated/`）、ビルド前タスクで再生成する。
- **client の API 呼び出し**: `openapi-fetch` で型安全に呼び出し、`TanStack Query` でキャッシュ・再取得を管理する。
- 生成タスクは Turborepo の依存に組み込み、`server:openapi` → `client:gen-types` → `client:build` の順を保証する。

## 理由

- **単一情報源**: Zod（common）→ OpenAPI（server）→ 型（client）と一方向に流すことで、型・実行時検証・API ドキュメントが 1 つの定義から導出され、ずれない。
- **openapi-typescript + openapi-fetch**: スキーマ駆動で、ランタイムをほとんど持たず軽量。TanStack Query と組み合わせて end-to-end の型安全を実現できる。
- OpenAPI を介すことで、将来 client/server を別リポジトリ・別言語にしても境界が保てる（疎結合）。

## 検討した代替案

- **common で型を直接共有（OpenAPI を介さない）**: monorepo なら可能で手軽。ただし HTTP 境界の契約（ステータス・パス・クエリ）がドキュメント化されず、API 仕様の外部提示や将来の分離に弱い。型 import は補助に留め、契約は OpenAPI に置く。
- **tRPC**: TS 同士なら型共有が非常に滑らか。ただし「REST + OpenAPI ドキュメント」「openapi-typescript 採用」という方針と外れ、HTTP 標準から離れる。不採用。
- **OpenAPI を手書き**: 二重管理になり Zod 定義とずれる。生成（zod-to-openapi）を採用。
- **tsoa でコードから OpenAPI 生成**: 有力だが、検証スキーマを `common` で共有する Zod 中心の設計と統一するため zod-to-openapi を採用（ADR-0004）。

## 影響（結果）

- 良い影響: フロント・バックの契約が型と実行時検証で二重に守られる。API ドキュメント（OpenAPI）が常に最新。
- トレードオフ: 生成ステップ（openapi.json → 型）がビルドに加わる。生成順序の管理が必要 → Turborepo で担保。
- フォローアップ: `openapi.json` の出力先・生成スクリプト、CI での型生成と差分チェックの方針を別 Issue で具体化。
