import type { ReactElement, ReactNode } from "react";

import { Link } from "./uiParts";

/** URL パターン（http(s):// で始まり、空白以外が続く） */
const URL_REGEX = /https?:\/\/\S+/g;

interface TextWithLinksProps {
  text: string;
  /** MUI Typography sx と同様のスタイル上書き（オプション） */
  sx?: object;
}

/**
 * テキスト中の http(s):// URL を `<a target="_blank" rel="noopener noreferrer">` リンクに変換する（#515）。
 * 生 HTML 注入を使わず React 要素として組み立てることで XSS を防ぐ。
 * URL 以外のテキスト部分はそのまま文字列として表示される。
 */
export const TextWithLinks = ({ text }: TextWithLinksProps): ReactElement => {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // URL_REGEX はフラグ g を持つのでループで全マッチを取る
  const regex = new RegExp(URL_REGEX.source, "g");
  while ((match = regex.exec(text)) !== null) {
    const [rawUrl] = match;
    const matchIndex = match.index;

    // URL より前のテキスト
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    // 末尾の句読点・括弧類を URL から除去（日本語テキストに続く場合）
    const url = rawUrl.replace(/[。、.,!?!?）)）\]】]+$/, "");
    const trailingPunctuation = rawUrl.slice(url.length);

    parts.push(
      <Link
        key={matchIndex}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ wordBreak: "break-all" }}
      >
        {url}
      </Link>,
    );

    if (trailingPunctuation) {
      parts.push(trailingPunctuation);
    }

    lastIndex = matchIndex + rawUrl.length;
  }

  // URL より後のテキスト
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
};
