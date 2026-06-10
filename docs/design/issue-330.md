# 設計書: 旧 Channel/Message/Task/ChannelMembership のコードを全削除する（ADR-0019 後処理） (#330)

## 1. 目的 / 背景

ADR-0019 で「旧 Message / Channel / ChannelEmployee / Task は削除」と確定し、#305 で Prisma スキーマから削除された。しかし #305 では旧リポジトリを InMemory スタブに差し替えることでビルドエラーを回避したため、旧ドメインコードが宙に浮いたまま残存している。本 Issue でそれらを一掃する。

## 2. スコープ（やること / やらないこと）

### やること
- Issue 本文に列挙された旧コードの完全削除
- ビルド・テスト・lint が全緑になるように必要な周辺修正
- 旧コードに依存していた planningBatch / researcherBatch / runSummaryBatch の削除（Issue #335 の対象だが、旧 repo 削除後にビルドが通らないため本 Issue で先行削除）

### やらないこと
- `server/src/batch/aiMessageGenerator.ts` の削除（`runCommunityBatch.ts` がインポートしており、新バッチに必要）
- `server/src/batch/schedule.ts` の削除（純粋なスケジューリングロジックで旧コードへの依存なし）
- 新バッチ（`communityBatchIndex.ts` / `runCommunityBatch.ts`）への変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `common/src/domain/channel/`, `message/`, `task/`, `channelMembership/` ディレクトリが削除されている
2. `common/src/index.ts` からこれらのエクスポートが削除されている
3. `common/src/logic/` の旧依存ファイル（`buildChannelConversationPrompt.ts`, `parseConversationMessages.ts`, `summarizeChannel.ts`, `buildRosterMessages.ts`）が削除されている
4. `server/src/routes/channels.ts`, `messages.ts`, `planning-issues.ts` が削除され、`app.ts` からの登録も外れている
5. `server/src/batch/runAiMessageBatch.ts`, `runMessageBatch.ts`, `index.ts`（旧エントリ）, `rosterMessageGenerator.ts` が削除されている
6. `server/src/batch/planningBatch.ts`, `researcherBatch.ts`, `runSummaryBatch.ts` が削除されている（旧 channel/message repo への依存を解消するため）
7. `server/src/persistence/channelRepository.ts`, `messageRepository.ts`, `channelMembershipRepository.ts`（interface + InMemory + Prisma 実装）が削除されている
8. `server/src/composition/createPrismaDeps.ts` から旧 InMemory スタブ注入が外れている
9. `server/src/app.ts` の `AppDeps` から `messageRepository`, `channelRepository`, `channelMembershipRepository` が削除されている
10. `grep -r "ChannelRepository\|MessageRepository\|ChannelMembership" server/src/ --include="*.ts"` がヒットしない
11. `pnpm turbo run build test lint` がすべて緑になる

## 4. 設計方針

### 依存ツリーの削除順序（下から上へ）

```
common/src/domain/{channel,message,task,channelMembership}
    ↓ import
common/src/logic/{buildChannelConversationPrompt,parseConversationMessages,summarizeChannel,buildRosterMessages}
    ↓ import
server/src/persistence/{channelRepository,messageRepository,channelMembershipRepository} + Prisma 実装
    ↓ import
server/src/batch/{runAiMessageBatch,runMessageBatch,rosterMessageGenerator,planningBatch,researcherBatch,runSummaryBatch}
server/src/usecases/{createMessages,listMessages,channelMembers,generateAiResponsesForChannel}
server/src/routes/{channels,messages,planning-issues}
    ↓ import
server/src/app.ts (AppDeps インターフェース + ルート登録の変更)
server/src/composition/createPrismaDeps.ts (InMemory スタブ除去)
server/src/testing/createTestDeps.ts (InMemory スタブ除去)
server/src/index.ts (公開エクスポート整理)
```

### aiMessageGenerator.ts は保持

`server/src/batch/aiMessageGenerator.ts` は Anthropic API ラッパーのみで旧ドメイン依存なし。`runCommunityBatch.ts` が利用しているため削除しない。

### planningBatch.ts 等の先行削除について

Issue #335 のスコープだが、channelRepository/messageRepository を直接使用しており削除後のビルドが通らない。受け入れ条件9 (`pnpm turbo run build test lint` 全緑) を満たすため本 Issue で先行削除する。

## 5. 影響範囲 / 既存への変更

| ワークスペース | 変更種別 | 主な内容 |
|---|---|---|
| `common` | 削除 | domain/{channel,message,task,channelMembership}, logic/{buildRosterMessages,...} |
| `common` | 修正 | index.ts から旧エクスポート除去 |
| `server` | 削除 | routes, batch, persistence, usecases の旧コード |
| `server` | 修正 | app.ts, createPrismaDeps.ts, createTestDeps.ts, index.ts |
| `client` | 変更なし | 旧 Message/Channel API を直接呼んでいない |

## 6. テスト計画

本 Issue は削除のリファクタリングのため、TDD の「失敗するテストを先に書く」アプローチは適用しない。代わりに既存テストが削除後も全て通ることを検証する。

- 削除対象コードのテストも合わせて削除
- `schedule.test.ts`: `runMessageBatch` に依存したテストを純粋モックに置き換え
- 最終確認: `pnpm --filter @hatchery/common test`, `pnpm --filter @hatchery/server test`, `pnpm lint`

## 7. リスク・未決事項

- Issue #335（旧 goal 系バッチの全削除）の作業が本 Issue で先行完了する。#335 は残作業確認のみ。
