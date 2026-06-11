import { test as base, expect } from "@playwright/test";

/**
 * Playwright には Vitest のような `test.todo()` が無いため、
 * `test.fixme(title, body)`（実行されず fixme としてレポートされる）を
 * `test.todo(title)` という API で提供する薄いラッパー（Issue #393）。
 *
 * 各エリアの spec はここから `test` を import し、usecases.md のユースケース
 * 見出しと 1:1 の `test.todo("UC-...-NN: ...")` を宣言する。
 * 実テストへの置き換え時は `test.todo(title)` を `test(title, async ({ page }) => ...)`
 * に書き換えるだけでよい。
 */
export const test = Object.assign(base, {
  todo: (title: string): void => {
    base.fixme(title, () => {
      // usecases.md のユースケースに対応する未実装スケルトン。
    });
  },
});

export { expect };
