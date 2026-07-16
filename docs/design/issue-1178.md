# 設計書: ADR-0030 の旧コミュニティ選定ロジック（selectTargetCommunity等）を削除する (#1178)

## 1. 目的 / 背景

ADR-0030「vote 重み付きランダムで 1 コミュニティだけ選ぶ」旧方式は、ADR-0033（全コミュニティ並列化）・ADR-0034
（post/comment バッチ分離）により置き換え済みで、CLAUDE.md にも現行仕様（各バッチが `Promise.allSettled` で
全コミュニティを並列処理する）が明記されている。

しかし旧方式由来のコードが削除されずに残っている:

- `server/src/batch/selectTargetCommunity.ts`
- `common/src/logic/selectWeightedCommunity.ts`
- `common/src/logic/buildCommunityWeights.ts`

実装調査の結果、`runPostBatch.ts`・`runCommentBatch.ts` などの実際のバッチエントリポイントはこれらを
一切 import しておらず、`.test.ts` 自身からしか参照されない dead code であることを確認した。
それにもかかわらず `common/src/index.ts` から `export *` され続けており、公開 API 上は現行仕様の一部に
見えてしまっている。

## 2. スコープ（やること / やらないこと）

**やること**:
- `server/src/batch/selectTargetCommunity.ts` と対応する `.test.ts` を削除する。
- `common/src/logic/selectWeightedCommunity.ts`・`common/src/logic/buildCommunityWeights.ts` と
  それぞれの `.test.ts` を削除する。
- `common/src/index.ts` から上記2ファイルの re-export を削除する。

**やらないこと（スコープ外）**:
- `runPostBatch.ts`・`runCommentBatch.ts` 自体のロジック変更。
- ADR-0030 のドキュメント自体の書き換え（ADR は決定の記録として残し、Superseded 状態は既存のまま）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `server/src/batch/selectTargetCommunity.ts`・`.test.ts` が存在しない。
2. `common/src/logic/selectWeightedCommunity.ts`・`.test.ts` が存在しない。
3. `common/src/logic/buildCommunityWeights.ts`・`.test.ts` が存在しない。
4. `common/src/index.ts` に `selectWeightedCommunity.js`・`buildCommunityWeights.js` の re-export 行が無い。
5. `grep -rn "selectTargetCommunity\|selectWeightedCommunity\|buildCommunityWeights" server/src common/src client/src --include="*.ts"` が 0 件。
6. `pnpm turbo run build test lint` が全ワークスペースで緑。

## 4. 設計方針

削除のみで完結する chore。新規モジュール・新規抽象化は導入しない。
`common/src/index.ts` の該当 export 行を削除し、依存グラフ上の dangling import が発生しないことを
ビルドで確認する。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: server / common）

- `server/src/batch/`: ファイル削除のみ。
- `common/src/logic/`: ファイル削除のみ。
- `common/src/index.ts`: export 文2行の削除。
- `client/`: 変更なし（もともと参照していない）。

## 6. テスト計画（TDDで書くテスト一覧）

本 Issue は「dead code の削除」が目的であり新規に振る舞いを追加するものではないため、新規テストは
追加しない。TDD サイクルは以下の順で「削除後に既存スイートが全て緑のまま」であることの確認に置き換える:

1. 削除前に `grep` で対象シンボルの非テスト参照が無いことを再確認（既に Issue 本文で確認済み・再現）。
2. 対象ファイル・re-export を削除。
3. `pnpm turbo run build test lint` を実行し、全て緑であることを確認（削除によって壊れる依存が無いことの検証）。

## 7. リスク・未決事項

- 特になし。旧方式の ADR-0030 自体は記録として残す（Superseded 済みのドキュメントの扱いは変更しない）。
- ユーザー可視の振る舞い変更は無いため、e2e usecases の更新は不要（PR 本文にその旨を明記する）。
