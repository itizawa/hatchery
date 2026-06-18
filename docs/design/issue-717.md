# 設計書: client/src/hooks/useExternalLink.ts の isExternalUrl 関数と ExternalLinkProvider のユニットテストを追加する (#717)

## 1. 目的 / 背景

`client/src/hooks/useExternalLink.ts` は外部リンク確認モーダルの制御フック（#661）で、`isExternalUrl` 純粋関数と `ExternalLinkProvider`・`useExternalLink` フックを含む。対応するテストファイルが存在しないため、変更時の回帰検知ができない。

## 2. スコープ（やること / やらないこと）

やること:
- `isExternalUrl` の各ケースを純粋関数としてユニットテスト
- `useExternalLink` の基本フロー（`openExternalLink` 呼び出し → `pendingUrl` がセットされる）をテスト
- `ExternalLinkDialog` のレンダリングテストはスコープ外

やらないこと:
- `ExternalLinkDialog` コンポーネント自体のテスト（別 Issue）
- window.open の実際の呼び出し確認は副次的（main はフック動作の検証）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `client/src/hooks/useExternalLink.test.tsx`（既存・ Issue #661 で作成済み）を更新し、以下を追加検証する
2. `isExternalUrl` の正常系:
   - 外部 `https://` URL → `true`
   - 外部 `http://` URL → `true`
   - 相対パス (`/path`・`./relative`) → `false`
   - 同一オリジン URL → `false`
   - 非 http(s) スキーム (`ftp://`・`mailto:`) → `false`
   - 不正 URL（解析エラー） → `false`
3. `useExternalLink` の基本フロー: `openExternalLink` を呼ぶと `pendingUrl` がセットされる
4. `pnpm --filter @hatchery/client test` が全件グリーン
5. `pnpm turbo run lint` がグリーン

## 4. 設計方針

- `isExternalUrl` は純粋関数なので直接 import してテスト（React 不要）
- `ExternalLinkProvider` のテストは `renderHook` + `render` を使用
- `window.location.origin` のモックは `vi.stubGlobal` で行う（テスト間で独立）
- `localStorage` のモックは既存の `useViewMode.test.ts` パターンを踏襲
- `window.open` は `vi.spyOn` でモック
- 既存テストファイル（`useExternalLink.test.tsx`）に `isExternalUrl` の直接ユニットテストを追記する

## 5. 影響範囲

- 対象ワークスペース: client のみ
- 更新ファイル: `client/src/hooks/useExternalLink.test.tsx`（既存ファイルに `isExternalUrl` テストブロックを追記）

## 6. テスト計画

1. `isExternalUrl` の各ケース（純粋関数テスト）— 新規追加
2. `ExternalLinkProvider` + `useExternalLink` のフロー — 既存テスト維持

## 7. リスク・未決事項

- `window.location.origin` は jsdom 環境では `http://localhost` になるため、外部リンク判定は `http://localhost` 以外のホストを使えばテストできる
