# Claude Code routine によるリリース自動化 — 登録手順

本ドキュメントは `develop → main` 昇格後にタグ・GitHub Release・リリースノートを自動生成する Claude Code routine の登録手順を説明する。routine は `/schedule` コマンドで登録するクラウドエージェントで、cron スケジュールで定期実行される。

## 概要

routine が実行するコマンド: `.claude/commands/release.md`（`/release`）

動作:
1. `main` に最新タグ以降の未タグのマージがあるか検知する
2. 最新マージ PR タイトルから `vX.Y.Z` を確定する
3. 同名タグが既に存在する場合はスキップ（冪等）
4. タグ作成・push・GitHub Release 作成・リリースノート生成を実行する

## 登録手順

### 1. 前提条件を確認する

- Claude Code に GitHub 連携（`gh` 認証）があること
- リポジトリに `contents: write` 権限を持つトークンが使えること
- `develop → main` 昇格 PR のタイトルに `vX.Y.Z` が含まれていること（現行の命名規則を維持）

### 2. routine を登録する

Claude Code で以下を実行:

```
/schedule
```

プロンプトに対して:
- **コマンド**: `/release`（`.claude/commands/release.md` を実行）
- **スケジュール**: `0 * * * *`（毎時 0 分）または任意の間隔
- **説明**: `GitHub リリースノート自動生成`

毎時実行で未タグのマージを検知し、あればタグと Release を自動作成する。発火頻度が多くてもスキップ判定（冪等）で二重作成しない。

### 3. 動作確認

登録後、`develop → main` 昇格 PR をマージし、次の routine 実行タイミングで:
- `vX.Y.Z` タグが作成されること
- GitHub Release が作成されリリースノートが設定されること

## 旧 GitHub Actions ワークフローとの違い

| 項目 | 旧 (`release-tag.yml`) | 新（routine） |
|------|------------------------|---------------|
| 起動トリガー | `pull_request: closed`（イベント駆動） | cron ポーリング |
| 起動タイミング | main マージ直後 | 次の cron 実行タイミング（最大 1 時間の遅延） |
| ノート生成 | pnpm スクリプト + `ANTHROPIC_API_KEY` シークレット | Claude Code routine が直接生成 |
| Node/pnpm セットアップ | Actions で毎回セットアップ | 不要 |
| 冪等性 | 同名タグが存在する場合はスキップ | 同名 Release が存在する場合はスキップ |

## 注意事項

- **タイミング遅延**: イベント駆動ではないため、main マージから最大 1 時間の遅延が発生する
- **PR タイトル規則**: `vX.Y.Z` を含まないタイトルの場合、バージョンを抽出できずスキップされる（現行と同じ動作）
- **手動トリガー**: 緊急リリースが必要な場合は `/release` を Claude Code で手動実行できる
