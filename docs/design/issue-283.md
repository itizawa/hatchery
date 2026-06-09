# 設計書 Issue #283: concept.md を現行実装・ADR・マイルストーン方向に整合させる

- 対象 Issue: #283（docs）
- 種別: ドキュメント整合（正本への追従更新）。新仕様は発明しない。
- 対象ファイル: `concept.md`（主）
- 参照する正本: `docs/adr/0009-remove-scene-direct-message-channel.md`、`docs/adr/0015-reaffirm-spa-cloudflare-functions-ogp.md`、`server/src/batch/runAiMessageBatch.ts`、`server/src/usecases/generateAiResponsesForChannel.ts`、`server/src/batch/runSummaryBatch.ts`、マイルストーン v1.0.0

## 方針

これは「企画の方向転換」ではなく「正本（Accepted な ADR + 実装済みの挙動 + 確定済みマイルストーン v1.0.0）への concept.md の追従更新」。新しい仕様を発明せず、判断が割れる点（特にあらすじの今後の扱い）は本文で断定せず「現状こうなっている / 要追補」と棚卸しに留める。コード・スキーマは変更しない（docs-only）。

## 現状の正本の確認（コードと ADR で裏取り済み）

1. **Scene 廃止（ADR-0009 / Accepted）**: ドメインから Scene を廃止し、message は channel に直接紐づくフラット構造。`common`・`server` の実装に Scene ドメインは存在しない（`common/src/index.ts` に「Scene は ADR-0009（#27）で廃止」のコメントのみ）。定時バッチは「1 コールで複数 message」を生成するが Scene でまとめず channel 紐づきで永続化する。
2. **二系統の生成（実装済み）**:
   - 定時バッチ `runAiMessageBatch`（`server/src/batch/runAiMessageBatch.ts`）— 1 日数回、zatsudan タイプの各チャンネルで bot 社員の掛け合いを 1 API コールで生成・検証・永続化。
   - 投稿トリガのリアクティブ応答 `generateAiResponsesForChannel`（`server/src/usecases/generateAiResponsesForChannel.ts`・#183）— ユーザー投稿をトリガに AI 社員の掛け合いを非同期生成。マイルストーン v1.0.0 のゴール「メッセージを投げかけたら AI 社員が自律的に考えて投稿する」に対応。
   - 両者は共通の `buildChannelConversationPrompt` / `parseConversationMessages` / `formatRecentLog` / `calcPostedAtOffsets` を使う。
3. **あらすじ（summary）の食い違い**: ADR-0009 は「あらすじ廃止・`formatRecentLog` で直近ログを使う」と決定したが、実装には `runSummaryBatch`（`server/src/batch/runSummaryBatch.ts`）と `channelRepo.getSummary()` が残り、`buildChannelConversationPrompt` に summary を渡している（定時バッチは summary 注入、投稿トリガは `summary: null`）。→ 「現状こうなっている / ADR-0009 と食い違っており要追補」と棚卸しに留める（ADR 本文修正は本 Issue スコープ外）。
4. **MVP スコープの超過**: 当初 MVP は「3 人 / 2ch / 2 定時・経験値/進化/関係値なし」。実装は仮想オフィス・招待・admin・Employee 編集・公開チャンネル（ADR-0015）等で当初 MVP を超過済み。

## どの記述をどう直すか（棚卸し）

| 箇所 | 現状の記述 | 直し方 |
|------|-----------|--------|
| 冒頭ステータス | 「設計メモ・検証前」 | 「実装フェーズに入っており、本メモと実装/ADR が食い違う箇所は ADR + 実装が正本」と注記し、関連 ADR への相互参照を冒頭に置く |
| 最小1ループ §5 | 「観察者が投げた話題は次の定時で拾う」 | 投稿トリガ即応答（#183）と定時バッチの二系統併存に更新 |
| 最小1ループ §6 | 「あらすじは不要。formatRecentLog」 | ADR-0009 はあらすじ不要としたが実装に summary が残る旨を注記 |
| 用語ミニ定義 | 「定時バッチ」定義 | 維持しつつ「投稿トリガ応答」を追加 |
| 動作モデル章 | 「定時方式のみ採用／個別駆動を退けた」 | 二系統（定時バッチ + 投稿トリガのリアクティブ応答）併存へ更新。個別駆動の否定は「並行モノローグを避ける」趣旨として残しつつ、投稿トリガでも掛け合いを生成する点を明記 |
| 「生成方式：1定時1APIコール（シーン単位）」 | 見出しに「シーン単位」、本文「1シーン丸ごと」 | 見出しを Scene 非依存に（「1回の生成1APIコール（チャンネル単位のまとめ生成）」）。本文の「シーン」を「まとめ生成」「1回の生成」へ。Scene 廃止（ADR-0009）への参照を付す |
| 入力ユーザーメッセージ例 | 「朝の始業」等のシーン語 | 「定時」の文脈語として残しつつ、Scene ドメインとは無関係である旨。深追いしない |
| 出力フォーマット章 JSON 例 | `"scene": "朝の始業"` フィールドあり | `scene` フィールドを JSON 例から削除し、フィールド型定義表からも `scene` 行を削除。message が channel 直結のフラット構造（ADR-0009）である旨を明記 |
| 処理フロー図 / 要約パイプライン / 記憶三層 | 「あらすじ更新」「synopsis」前提 | ADR-0009 のあらすじ廃止方針と、実装に summary が残る現状の食い違いを棚卸し注記。Phase 1 の構想であることを明示 |
| world_state テーブル | `synopsis` カラム | 「ADR-0009 であらすじは廃止方針。実装の summary は別経路（runSummaryBatch / getSummary）に存在し要追補」と注記 |
| MVP / 最小プロトタイプ章 | 「3人/2ch/2定時」を現行スコープのように記述 | 「企画当初の最小スコープ」と明示し、実装の現在地（仮想オフィス・招待・admin・公開チャンネル等で超過済み）を反映 |
| 拡張ロードマップ | Phase 2/3 として共有・公開を将来扱い | 公開チャンネル（ADR-0015）は実装/計画済みである旨を注記 |
| 全体 | ADR 参照なし | ADR-0009 / 0015 / 0004 / 0005 への相互参照を張る |

## 受け入れ条件との対応

- 受け入れ条件 1（Scene 表現の更新・JSON 例から scene 削除）→ 「生成方式」見出し・出力フォーマット章・JSON 例・型定義表を更新。
- 受け入れ条件 2（二系統の明記）→ 動作モデル章・最小1ループ・用語定義を更新。
- 受け入れ条件 3（あらすじの食い違い棚卸し）→ 各あらすじ関連章に注記。
- 受け入れ条件 4（MVP 現在地）→ MVP / 最小プロトタイプ章を更新。
- 受け入れ条件 5（ADR 相互参照・矛盾ゼロ）→ 冒頭と各該当箇所に ADR 参照を付与。
- 受け入れ条件 6（docs-only・CI 緑）→ concept.md と本設計書のみ変更。`pnpm turbo run build test lint` 緑を確認。

## テスト方針

ドキュメントのみの変更のため新規ユニットテストは不要（コード・スキーマ不変）。検証は `pnpm turbo run build test lint` が緑であること、および `pnpm test:repo`（リポジトリ規約テスト）が緑であることで担保する。整合性（矛盾ゼロ）はセルフレビューで確認する。
