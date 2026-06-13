# Issue #425 設計: appSettingRepository（インメモリ実装）と pgSessionStore のテストを追加する

## 背景・目的

server の永続化層で次の 2 ファイルにテストが無い。本 Issue はテスト基盤側のリグレッションを防ぐため、これらの契約をユニットテストで固定する（純粋なテスト追加。プロダクションコードは変更しない）。

- `server/src/persistence/appSettingRepository.ts` — インメモリ実装 `createInMemoryAppSettingRepository`（`findAll` / `findByKey` / `upsert`）。同種のインメモリリポジトリは #376（worker）・#377（invitationLink）でテスト済みだが appSetting だけ未整備。
- `server/src/persistence/pgSessionStore.ts` — `createPgSessionStore`（#186）。`pg.Pool` 生成と connect-pg-simple の組み立てが未検証。

## 受け入れ条件 → 入出力（テスト項目）

### 1. `appSettingRepository.test.ts`

対象: `createInMemoryAppSettingRepository(initialSettings)` が返す `AppSettingRepository`。

- `findAll`
  - 空（`initialSettings` 未指定）→ `[]` を返す。
  - 複数件 → 全件を返す。
  - 返却値が内部状態のコピーであること（返却配列の要素を書き換えても次回 `findAll` / `findByKey` に影響しない）。
  - コンストラクタに渡した `initialSettings` も防御的コピーされること（外部配列の要素を書き換えても内部状態に影響しない）。
- `findByKey`
  - ヒット → 対応する `AppSetting` を返す。
  - ミス（存在しない key）→ `null`。
- `upsert`
  - 新規作成 → 新しい `AppSetting`（`key` / `value` / `updatedAt`）を返し、以後 `findByKey` で取得できる。`findAll` の件数が増える。
  - 既存更新 → `value` と `updatedAt` が更新される。件数は増えない。`updatedAt` は更新前より後（または等しくなく進む）。
  - 戻り値が内部状態のコピーであること（戻り値を書き換えても内部に影響しない）。

### 2. `pgSessionStore.test.ts`

対象: `createPgSessionStore(databaseUrl)`。実 DB 接続は必須としない（`pg` / `connect-pg-simple` をモック）。

- `session.Store` のインスタンスを返すこと。
- `connect-pg-simple` のストアが `tableName: "session"` を含む options で構成されること。
- `pg.Pool` が `connectionString: databaseUrl` で生成されること。

## 設計判断

- **TDD**: まずテストを書いて失敗を確認 → コミット → （プロダクションコードは既存で正しいため）緑を確認、の順で進める。本 Issue はプロダクション挙動の変更を伴わないテスト整備のため、実装側の変更は行わない。
- **pgSessionStore のモック方針**: `createPrismaDeps.test.ts` で確立済みの `vi.mock(...)` モジュールモックパターンを踏襲する。`pg` と `connect-pg-simple` をモックし、
  - `pg.Pool` を `vi.fn()` のコンストラクタモックにして `connectionString` 引数を検証。
  - `connect-pg-simple` のデフォルトエクスポートを「`session.Store` を継承したダミー Store クラスを返すファクトリ」にモックし、`new PgSession(options)` の `options.tableName` を検証。`instanceof session.Store` 判定のため、ダミー Store は実 `express-session` の `session.Store` を継承させる。
- **時刻検証**: `upsert` の `updatedAt` 更新は `vi.useFakeTimers()` で時刻を前進させて「更新後が更新前より新しい」ことを確定的に検証する（実時間依存で flaky にしない）。
- **import 境界**: server 内テストのみ。client/server 相互依存や ADR-0023 の制約には抵触しない。

## ユーザー可視の振る舞い

無し（純粋なバックエンドのテスト追加でユーザー可視挙動は変わらない）。よって `e2e/` ユースケースの更新は不要。

## スコープ外

- セッションストアの実 DB 結合テスト（#378 系の基盤拡張として別途）。
- Prisma 実装側 `prismaAppSettingRepository.test.ts` は既存のため対象外。
