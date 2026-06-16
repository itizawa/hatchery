# Issue #602: リリースタグ作成時に AI が統一フォーマットのリリースノートを自動生成する

## 背景・目的

develop → main 昇格時に `.github/workflows/release-tag.yml` がタグ + GitHub Release を自動作成しているが、ノート本文はコミット羅列のみ。  
AI に**統一フォーマット**のリリースノートを生成させ、リリースごとのフォーマットのばらつきと手動依頼を廃止する。

## 実装方針

「AI に JSON を出力させ → Zod で検証し → 固定テンプレートで markdown 描画」することでフォーマットを **コードで強制** する。

---

## 受け入れ条件と実装対応

### AC1: common の Zod スキーマ・プロンプト・描画関数（TDD）

**ファイル**: `common/src/releaseNotes/`

| 要素 | 実装 |
|------|------|
| `ReleaseNotesSummarySchema` | Zod スキーマ。`overview`（概要 1〜2 文）+ `categories`（カテゴリ別配列）。全フィールドに `.max()` 付き |
| `buildReleaseNotesPrompt(version, commitLines)` | プロンプト生成純粋関数 |
| `renderReleaseNotesMarkdown(summary)` | スキーマ→固定 markdown 描画純粋関数 |

**スキーマ構造**:
```ts
ReleaseNotesSummarySchema = z.object({
  overview: z.string().min(1).max(500),         // 概要（1〜2 文）
  features: z.array(z.string().max(200)).default([]),  // 新機能
  improvements: z.array(z.string().max(200)).default([]),  // 改善
  fixes: z.array(z.string().max(200)).default([]),  // 修正
  others: z.array(z.string().max(200)).default([]),  // その他
})
```

**markdown 描画フォーマット**:
```markdown
## 概要
<overview>

### ✨ 新機能
- <item>

### 🛠 改善
- <item>

### 🐛 修正
- <item>

### 🔧 その他
- <item>
```
空カテゴリは見出しごと省略（描画関数で一意に決定）。

**テスト**: `common/src/releaseNotes/releaseNotes.test.ts`  
- `buildReleaseNotesPrompt`: version・commitLines を含むプロンプトが生成されること、JSON 出力指示が含まれること
- `renderReleaseNotesMarkdown`: 代表的入力に対し固定文字列、空カテゴリ省略
- `ReleaseNotesSummarySchema`: `.max()` 超過の reject

### AC2: server のグルースクリプト

**ファイル**: `server/src/scripts/generateReleaseNotes.ts`

- 引数: `--version <vX.Y.Z>` + `--commits <コミット行1>` ... または stdin 読み込み
- 実装方針: `process.argv` から `--version` と `--commits` を受け取る形式にする（シンプルに引数渡し）
- フロー: `buildReleaseNotesPrompt` → Anthropic SDK → JSON パース → `ReleaseNotesSummarySchema.parse` → `renderReleaseNotesMarkdown` → **stdout に出力**
- エラー時: stderr に出力して **exit code 1** で終了（ワークフロー側が `|| true` で吸収）
- 依存注入: `ReleaseNotesGenerator = (prompt: string, apiKey: string) => Promise<string>` 型でスタブ化可能
- モデル: `claude-sonnet-4-6`（`DEFAULT_BATCH_MODEL` 定数を流用）

**テスト**: `server/src/scripts/generateReleaseNotes.test.ts`  
- 正常系: スタブが正常 JSON を返すとき markdown が stdout に出る
- パース失敗系: スタブが不正 JSON を返すとき exit code 1
- スキーマ不一致系: スタブが schema 違反 JSON を返すとき exit code 1

**script 追加**:  
`server/package.json` に `"release-notes": "tsx src/scripts/generateReleaseNotes.ts"` を追加。

### AC3: workflow 拡張

`.github/workflows/release-tag.yml` のリリース作成後段に以下を追加:

```yaml
- name: Generate AI release notes
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    # ... pnpm install + スクリプト実行 + gh release edit
    # 失敗しても continue-on-error: true で冪等
  continue-on-error: true
```

失敗時は `gh release create` が付けたコミット羅列ノートがそのまま残る（リリース自体は常に成立）。

---

## アーキテクチャ上の制約

- common には Node/SDK 依存を持ち込まない（純粋 TypeScript + Zod のみ）
- SDK 呼び出しは server 側にのみ置く
- 一方向 import 境界を守る: `server → common`（逆は禁止）

## e2e ユースケース

GitHub Releases の表示は画面遷移を伴わない GitHub UI 上の変更のため、`e2e/usecases.md` の更新は不要。

---

## TDD 実施順

1. `common/src/releaseNotes/releaseNotes.test.ts` を書く（失敗確認）
2. コミット
3. `common/src/releaseNotes/releaseNotes.ts` を実装（緑）
4. `common/src/index.ts` に export 追加
5. `server/src/scripts/generateReleaseNotes.test.ts` を書く（失敗確認）
6. コミット
7. `server/src/scripts/generateReleaseNotes.ts` を実装（緑）
8. `server/package.json` に script 追加
9. `.github/workflows/release-tag.yml` を拡張
10. `pnpm turbo run build test lint` で全緑確認
