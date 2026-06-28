# 設計書: リリースタグ/Release/ノート生成を GitHub Actions から Claude Code routine に移行する (#974)

## 1. 目的 / 背景

develop → main 昇格 PR マージ後に `.github/workflows/release-tag.yml` が起動し、タグ作成・GitHub Release 作成・AI リリースノート生成を行っていた。この CI ワークフローは pnpm/Node セットアップ・`ANTHROPIC_API_KEY` シークレット・tsx スクリプト依存と機構が重い。

Claude Code routine（`/schedule` で登録するクラウドエージェント）を使えば、cron ポーリングで「main に未タグの新規マージがあるか」を検知し、リリースノートを含むタグ/Release 作成を routine 1 本で賄える。CI から上記の重い機構を取り除くことが目的。

## 2. スコープ（やること / やらないこと）

### やること

- `.claude/commands/release.md` を新設（routine プロンプト）
- `.github/workflows/release-tag.yml` を削除
- `docs/dark-factory-workflow.md` の release-tag.yml 記述を routine ベースに更新
- `docs/routine-release.md` を新設（routine の登録手順を人間向けに記述）

### やらないこと

- routine の実際の `/schedule` 登録（人間の後続作業）
- 既存リリース（v1.x.x）の遡及書き換え
- `generateReleaseNotes.ts` と common のリリースノートスキーマの削除（orphan になりうるが本 Issue の必須外）
- 多言語ノート対応

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `.claude/commands/release.md` が存在し、以下を定義している:
   - main の最新タグ以降に未リリースのマージがあるか検知する手順
   - vX.Y.Z の確定手段（最新マージ PR タイトルから抽出）
   - 同名タグが既に存在する場合はスキップ（冪等）
   - タグ作成・push・GitHub Release 作成・リリースノート生成（`## 概要` + カテゴリ別フォーマット）
   - 失敗時のフォールバック方針
2. `.github/workflows/release-tag.yml` が削除されている
3. `docs/dark-factory-workflow.md` の L109/L149/L178 付近が routine ベースの記述に更新されている
4. `docs/routine-release.md` が存在し、登録手順を記述している
5. `pnpm turbo run build test lint` が緑（既存テスト・lint を壊さない）

## 4. 設計方針

### ノート生成方式: 方式 (B)（routine がネイティブに生成）

Issue 推奨の (B) を採用。Claude Code routine は自身が LLM であるため、pnpm スクリプトを呼び出さずにコマンド内の固定テンプレートに従ってリリースノートを直接生成できる。

フォーマットは `renderReleaseNotesMarkdown` の出力（#602 統一フォーマット）に合わせて固定明記:

```markdown
## 概要
<リリース全体の概要 1〜2 文>

### ✨ 新機能
- <項目>

### 🛠 改善
- <項目>

### 🐛 修正
- <項目>

### 🔧 その他
- <項目>
```

（該当なしのカテゴリは省略）

### バージョン確定方式

`gh pr list --base main --state merged --limit 1` で最新マージ PR を取得し、タイトルから `vX.Y.Z` を抽出。取得できない場合は何も作成せずスキップ。

### 冪等スキップ

`gh release view <version>` で既存 Release を確認。既に存在する場合はスキップ。

### 未タグ検知

`git tag --list` で最新タグを取得し、`gh pr list --base main --state merged` で最新マージ PR SHA と最新タグのコミット SHA を比較。一致すれば未タグのマージはなくスキップ。

## 5. 影響範囲 / 既存への変更

- `.github/workflows/release-tag.yml`: **削除**
- `.claude/commands/release.md`: **新規追加**
- `docs/dark-factory-workflow.md`: **更新**（L109/L149/L178 付近の release-tag.yml 記述を routine ベースへ）
- `docs/routine-release.md`: **新規追加**
- `server/src/scripts/generateReleaseNotes.ts`: 変更なし（orphan になるが削除は別 Issue）
- `common/src/releaseNotes/`: 変更なし

## 6. テスト計画（TDDで書くテスト一覧）

本 Issue は主に config/docs 変更。既存の common/server リリースノート関連テストは変更なし。

TDD として確認すべき内容（既存テストが壊れていないことの確認）:
- `pnpm --filter @hatchery/common test`（`releaseNotes.test.ts`）が緑であること
- `pnpm --filter @hatchery/server test`（`generateReleaseNotes.test.ts`）が緑であること
- `pnpm lint` が緑であること

新規プロダクトコードが無いため、新規テストは不要。

## 7. リスク・未決事項

- **routine 登録タイミング**: `release.md` を配置しても `/schedule` 登録は人間の後続作業。登録前は既存 CI ワークフローが削除されてもリリース自動化が一時的に停止する。ただし、Issue 本文の前提通り「PR に含まれるのはプロンプト整備まで」とし、人間が即座に登録すれば問題ない。
- **cron 間隔と検知遅延**: routine は「イベント起動不可」のためポーリング。cron 設定は `/schedule` 登録時に人間が決める（例: 毎時実行）。
- **generateReleaseNotes.ts の orphan**: 本 Issue では削除しない。将来の別 Issue で対応。
