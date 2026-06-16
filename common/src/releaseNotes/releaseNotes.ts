import { z } from "zod";

/**
 * リリースノートの概要の最大文字数。
 * AI 出力もユーザー表示対象データとして上限を設ける（#91・#602）。
 */
export const RELEASE_NOTES_OVERVIEW_MAX_LENGTH = 500;

/**
 * リリースノートの各カテゴリ項目の最大文字数（#602）。
 */
export const RELEASE_NOTES_ITEM_MAX_LENGTH = 200;

/**
 * AI が出力するリリースノートの統一フォーマットスキーマ（#602）。
 * 「概要（1〜2 文）」 + カテゴリ別（新機能 / 改善 / 修正 / その他）の項目配列。
 * 全フィールドに .max() を付けること（#91: ユーザー表示文字列の上限必須）。
 */
export const ReleaseNotesSummarySchema = z.object({
  /** リリース全体の概要（1〜2 文）。AI が日本語で記述する。 */
  overview: z.string().min(1).max(RELEASE_NOTES_OVERVIEW_MAX_LENGTH),
  /** 新機能の箇条書き（ユーザー視点の要約）。 */
  features: z.array(z.string().min(1).max(RELEASE_NOTES_ITEM_MAX_LENGTH)).default([]),
  /** 改善の箇条書き（パフォーマンス・UX 等）。 */
  improvements: z.array(z.string().min(1).max(RELEASE_NOTES_ITEM_MAX_LENGTH)).default([]),
  /** バグ修正の箇条書き。 */
  fixes: z.array(z.string().min(1).max(RELEASE_NOTES_ITEM_MAX_LENGTH)).default([]),
  /** その他（依存更新・CI 整備・リファクタ等）の箇条書き。 */
  others: z.array(z.string().min(1).max(RELEASE_NOTES_ITEM_MAX_LENGTH)).default([]),
});

/** `ReleaseNotesSummarySchema` の推論型。 */
export type ReleaseNotesSummary = z.infer<typeof ReleaseNotesSummarySchema>;

/**
 * コミット一覧から AI へのプロンプト文字列を生成する純粋関数（#602）。
 * 「スキーマに沿った JSON のみを返せ」と指示し、フォーマットのばらつきを防ぐ。
 *
 * @param version バージョン文字列（例: "v1.3.0"）
 * @param commitLines コミット行の配列（例: ["- feat: ... (abc1234)", ...]）
 */
export function buildReleaseNotesPrompt(version: string, commitLines: string[]): string {
  const commitSection =
    commitLines.length > 0
      ? commitLines.join("\n")
      : "（このリリースに含まれるコミットはありません）";

  return `あなたはソフトウェアのリリースノートを生成するアシスタントです。
以下の ${version} のコミット一覧を読み、ユーザー向けのリリースノートを日本語で作成してください。

## コミット一覧

${commitSection}

## 出力形式

**必ず以下の JSON 形式のみを返してください。説明文・コードブロック記法・前置き文は一切不要です。**

{
  "overview": "リリース全体の概要を 1〜2 文で（最大 ${RELEASE_NOTES_OVERVIEW_MAX_LENGTH} 文字）",
  "features": ["新機能の要約（最大 ${RELEASE_NOTES_ITEM_MAX_LENGTH} 文字）"],
  "improvements": ["改善の要約（最大 ${RELEASE_NOTES_ITEM_MAX_LENGTH} 文字）"],
  "fixes": ["バグ修正の要約（最大 ${RELEASE_NOTES_ITEM_MAX_LENGTH} 文字）"],
  "others": ["その他の変更の要約（最大 ${RELEASE_NOTES_ITEM_MAX_LENGTH} 文字）"]
}

## ガイドライン

- overview: リリース全体を 1〜2 文で総括する（最大 ${RELEASE_NOTES_OVERVIEW_MAX_LENGTH} 文字）
- 各カテゴリ: 該当するコミットがない場合は空配列 [] を返す
- 各項目: ユーザー視点でわかりやすく要約する（最大 ${RELEASE_NOTES_ITEM_MAX_LENGTH} 文字）
- JSON 以外の文字列は出力しない`;
}

/**
 * `ReleaseNotesSummary` を**固定フォーマットの markdown** へ描画する純粋関数（#602）。
 * 空カテゴリは見出しごと省略する。描画順: overview → 新機能 → 改善 → 修正 → その他。
 *
 * @param summary `ReleaseNotesSummarySchema` に準拠したオブジェクト
 */
export function renderReleaseNotesMarkdown(summary: ReleaseNotesSummary): string {
  const lines: string[] = [];

  // 概要セクション（必ず出力）
  lines.push("## 概要");
  lines.push(summary.overview);

  // 新機能（空なら省略）
  if (summary.features.length > 0) {
    lines.push("");
    lines.push("### ✨ 新機能");
    for (const item of summary.features) {
      lines.push(`- ${item}`);
    }
  }

  // 改善（空なら省略）
  if (summary.improvements.length > 0) {
    lines.push("");
    lines.push("### 🛠 改善");
    for (const item of summary.improvements) {
      lines.push(`- ${item}`);
    }
  }

  // 修正（空なら省略）
  if (summary.fixes.length > 0) {
    lines.push("");
    lines.push("### 🐛 修正");
    for (const item of summary.fixes) {
      lines.push(`- ${item}`);
    }
  }

  // その他（空なら省略）
  if (summary.others.length > 0) {
    lines.push("");
    lines.push("### 🔧 その他");
    for (const item of summary.others) {
      lines.push(`- ${item}`);
    }
  }

  return lines.join("\n");
}
