/**
 * リリースノート自動生成スクリプト（#602）。
 *
 * 使い方:
 *   pnpm --filter @hatchery/server release-notes --version v1.3.0 --commits "- feat: ... (abc123)" "- fix: ..."
 *
 * フロー: buildReleaseNotesPrompt → Anthropic SDK → JSON パース → ReleaseNotesSummarySchema.parse → renderReleaseNotesMarkdown → stdout
 * エラー時: stderr に出力して exit code 1（ワークフロー側が continue-on-error: true で吸収する）
 */

import { pathToFileURL } from "node:url";

import Anthropic from "@anthropic-ai/sdk";
import { ReleaseNotesSummarySchema, buildReleaseNotesPrompt, renderReleaseNotesMarkdown } from "@hatchery/common";

import { DEFAULT_BATCH_MODEL } from "../config/env.js";

/**
 * リリースノート生成の max_tokens。
 * overview（最大 500 文字 ≈ 375 トークン）+ カテゴリ項目（最大 200 文字 × 複数）+ JSON 構造オーバーヘッドを考慮し、
 * 大規模リリースでも切り詰めが起きないよう十分な値を確保する。
 */
const RELEASE_NOTES_MAX_TOKENS = 2048;

/** AI にプロンプトを投げてテキストを返す関数型（DI 用）。 */
export type ReleaseNotesGenerator = (prompt: string, apiKey: string) => Promise<string>;

/** `runGenerateReleaseNotes` の引数。 */
export interface GenerateReleaseNotesOptions {
  /** バージョン文字列（例: "v1.3.0"）。 */
  version: string;
  /** コミット行の配列（例: ["- feat: ... (abc1234)", ...]）。 */
  commitLines: string[];
  /** Anthropic API キー。 */
  apiKey: string;
  /**
   * AI 呼び出し関数（テストでスタブ注入）。
   * 未指定のとき実 Anthropic SDK を使う（本番経路）。
   */
  generator?: ReleaseNotesGenerator;
}

/** `runGenerateReleaseNotes` の返り値。 */
export type GenerateReleaseNotesResult =
  | { success: true; markdown: string }
  | { success: false; error: string };

/**
 * AI 呼び出し → JSON パース → スキーマ検証 → markdown 描画のロジック層（テスト可能）。
 * コードブロック（```json ... ```）形式の出力も許容する。
 */
export async function runGenerateReleaseNotes(
  options: GenerateReleaseNotesOptions,
): Promise<GenerateReleaseNotesResult> {
  const { version, commitLines, apiKey, generator = createDefaultGenerator() } = options;

  try {
    const prompt = buildReleaseNotesPrompt(version, commitLines);
    const rawText = await generator(prompt, apiKey);

    // コードブロック記法（```json ... ``` または ``` ... ```）を除去してから JSON パース
    const jsonText = stripCodeBlock(rawText.trim());

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return {
        success: false,
        error: `AI の出力を JSON としてパースできませんでした。出力: ${rawText.slice(0, 200)}`,
      };
    }

    const validated = ReleaseNotesSummarySchema.safeParse(parsed);
    if (!validated.success) {
      return {
        success: false,
        error: `AI の出力が ReleaseNotesSummarySchema に一致しませんでした: ${validated.error.message}`,
      };
    }

    const markdown = renderReleaseNotesMarkdown(validated.data);
    return { success: true, markdown };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * コードブロック記法（```json ... ``` または ``` ... ```）を除去する。
 * AI がコードブロックで JSON を返した場合に対応する。
 */
function stripCodeBlock(text: string): string {
  // ```json\n...\n``` または ```\n...\n``` の形式
  const match = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (match && match[1] !== undefined) {
    return match[1].trim();
  }
  return text;
}

/**
 * 実 Anthropic SDK を使うデフォルトの ReleaseNotesGenerator を作る。
 */
function createDefaultGenerator(): ReleaseNotesGenerator {
  return async (prompt: string, apiKey: string): Promise<string> => {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: DEFAULT_BATCH_MODEL,
      max_tokens: RELEASE_NOTES_MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = message.content.find((c) => c.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text : "";
  };
}

/**
 * CLI エントリポイント。
 * 引数: --version <vX.Y.Z> [--commits <line1> <line2> ...]
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // --version を取得
  const versionIdx = args.indexOf("--version");
  if (versionIdx === -1 || !args[versionIdx + 1]) {
    console.error("エラー: --version <vX.Y.Z> を指定してください。");
    process.exit(1);
  }
  const version = args[versionIdx + 1] as string;

  // --commits 以降の引数をコミット行として扱う
  const commitsIdx = args.indexOf("--commits");
  const commitLines =
    commitsIdx !== -1
      ? args.slice(commitsIdx + 1).filter((a) => !a.startsWith("--"))
      : [];

  // ANTHROPIC_API_KEY を環境変数から取得
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("エラー: 環境変数 ANTHROPIC_API_KEY が設定されていません。");
    process.exit(1);
  }

  const result = await runGenerateReleaseNotes({ version, commitLines, apiKey });

  if (!result.success) {
    console.error(`リリースノート生成に失敗しました: ${result.error}`);
    process.exit(1);
  }

  process.stdout.write(result.markdown + "\n");
}

// 直接実行（tsx src/scripts/generateReleaseNotes.ts）のときだけ main を起動する。
// テストからの import ではスクリプトを実行しない。
// communityBatchIndex.ts と同じ確立済みパターン（pathToFileURL による厳密比較）を使う。
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error("予期しないエラーが発生しました:", err);
    process.exit(1);
  });
}
