# 設計書: fix: タブ復帰時に stale なクエリを再取得する（refetchOnWindowFocus を有効化）(#675)

## 1. 目的 / 背景

`client/src/queryClient.ts` のアプリ全体デフォルト `refetchOnWindowFocus: false` が原因で、タブ（ウィンドウ）にフォーカスを戻したとき、`staleTime`（30秒）を超えて古くなったクエリが再取得されず、古いデータが表示されたままになる。

`refetchOnWindowFocus: true` に変更することで TanStack Query 標準の「stale なクエリのみフォーカスで再取得」挙動を有効化し、タブ復帰時に最新データが表示されるようにする。

## 2. スコープ（やること / やらないこと）

**やること:**
- `client/src/queryClient.ts` の `refetchOnWindowFocus: false` → `true` に変更（1行変更）
- `client/src/queryClient.test.ts` に `refetchOnWindowFocus === true` と `staleTime === 30_000` の検証テストを追加
- `e2e/home-feed/usecases.md` にタブ復帰時の自動再取得ユースケース（UC-HOME-15）を追記

**やらないこと:**
- `refetchOnReconnect` / `refetchOnMount` の変更
- `staleTime` 自体のチューニング
- `'always'`（stale でなくても必ず再取得）の採用

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `createQueryClient()` が返す `QueryClient` の `defaultOptions.queries.refetchOnWindowFocus` が `true` である。
2. `createQueryClient()` が返す `QueryClient` の `defaultOptions.queries.staleTime` が `30_000` である（変更なし）。
3. `createQueryClient()` が返す `QueryClient` の `defaultOptions.queries.retry` が `1` である（変更なし）。
4. 既存テスト（QueryClient インスタンス返す・retry・独立インスタンス）が引き続き通る。
5. `pnpm turbo run build test lint` が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

変更は `client/src/queryClient.ts` の 1 行のみ。アーキテクチャ上の影響：

- TanStack Query は `refetchOnWindowFocus: true` のとき、`focus` / `visibilitychange` イベントで **stale** なクエリだけを再取得する（`staleTime: 30_000` があるため、30秒未満のキャッシュは再取得されない）。
- 各 Scene/コンポーネント側で個別に `staleTime` を上書きしているクエリ（`client/src/api/communities.ts` の `60_000` 等）の挙動はデフォルト変更の影響を受けない。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- **client**: `client/src/queryClient.ts`（1行変更）、`client/src/queryClient.test.ts`（テスト追加）
- **e2e**: `e2e/home-feed/usecases.md`（UC-HOME-15 追記）、`e2e/usecases.md`（索引更新）
- **server / common / docs**: 変更なし

## 6. テスト計画（TDDで書くテスト一覧）

`client/src/queryClient.test.ts` に以下を追加:
- `"refetchOnWindowFocus が true に設定される"` — `getDefaultOptions().queries?.refetchOnWindowFocus === true`
- `"staleTime が 30_000 に設定される"` — `getDefaultOptions().queries?.staleTime === 30_000`

## 7. リスク・未決事項

- 低リスク: 変更は 1 行のフラグ反転のみ。既存テストへの影響は型レベルで発生しない。
- 懸念なし: `staleTime: 30_000` を維持することで、無条件の API 爆撃は発生しない。
