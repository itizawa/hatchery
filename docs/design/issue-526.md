# 設計書: 生成プロンプトに「直近で扱った記事/題材の重複回避」を明示 (#526)

## 1. 目的 / 背景

観察エンタメの価値は「AI ワーカー同士の会話の多様性」にある。しかし同一記事を題材にした投稿が複数スロットにわたり重複することで、フィードの新鮮味が落ちている。

原因: `buildCommunityPrompt.ts` は直近ログ（`recentLog`）をプロンプトに載せるが、「そこで既に扱った話題と重複しないよう新しい題材を選ぶ」という明示的な制約指示がない。

## 2. スコープ（やること / やらないこと）

**やること:**
- `server/src/batch/buildCommunityPrompt.ts` のプロンプト文面に、`recentLog` がある場合に「直近ログで扱った記事・話題と重複しない新しい題材を選ぶ」旨の指示を追加する
- `server/src/batch/buildCommunityPrompt.test.ts` にテストを追加する

**やらないこと:**
- 外部フィード（Zenn トレンド）の動的取り込み（#491 のスコープ）
- ADR-0023 を逸脱するような機能追加
- 画面・API の変更（バックエンドのプロンプト文字列のみ）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `recentLog.length > 0` の場合、生成プロンプトに「直近ログで扱った記事・話題と重複しない」旨の文言が含まれる
2. `recentLog.length === 0` の場合も、プロンプトは壊れず正常に生成される（重複回避指示は出現しなくてよい）
3. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### プロンプト構造（#389 AC4 維持）

```
安定 prefix: TONE_GUIDELINES + description + synopsis + workers + recentPosts + popularPosts
可変 suffix: recentLogSection（← ここに重複回避指示を追加）
出力フォーマット指示
```

重複回避指示は `recentLog` の内容に依存するため、**可変 suffix である `recentLogSection` の中**に配置する。これにより安定 prefix / 可変 suffix の分割（キャッシュ構造）を維持できる。

### 実装方針

`recentLogSection` の構築ロジックを以下のように変更する:

```
recentLog.length > 0 の場合:
  「直近の投稿・コメント（N件）:\n<内容>\n\n（↑ 上記で扱った記事・話題と重複しない新しい題材を選んでください）」

recentLog.length === 0 の場合（現状維持）:
  「直近の投稿・コメント: (なし)」
```

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **server のみ**
- 変更ファイル: `server/src/batch/buildCommunityPrompt.ts`（実装）、`server/src/batch/buildCommunityPrompt.test.ts`（テスト追加）
- ユーザー可視の画面振る舞い: **なし**（e2e 更新不要）

## 6. テスト計画（TDD で書くテスト一覧）

`buildCommunityPrompt.test.ts` に以下を追加:

1. `recentLog があるとき重複回避の指示がプロンプトに含まれる (#526)` — `prompt` に「重複しない」が含まれること
2. `recentLog が空のとき重複回避の指示はプロンプトに含まれない (#526)` — 空 recentLog でもプロンプトが正常生成され、「重複しない」は含まれない（または含まれてもよい、自然な文面であること）
3. `重複回避指示は recentLog より後・JSON 出力指示より前に置かれる (#526)` — プロンプトキャッシュ構造が維持されていること

## 7. リスク・未決事項

- なし（最小限のプロンプト文字列変更のみ）
