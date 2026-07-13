/**
 * Markdown コンテンツを安全にレンダリングするコンポーネント（Issue #513）。
 *
 * - `react-markdown` + `remark-gfm` で GFM サブセットをサポート
 * - `rehype-sanitize` で XSS を防止（<script> / javascript: スキーム / onerror 等を無害化）
 * - 画像（img タグ）は描画しない（インライン画像埋め込みを許可しない）
 * - リンクは target="_blank" + rel="noopener noreferrer" で新規タブで開く
 * - MUI コンポーネントにマッピングしてテーマと整合させる
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Fragment, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { Link as RouterLink } from "@tanstack/react-router";
import { detectWorkerMentions } from "@hatchery/common";
import type { WorkerMentionCandidate } from "@hatchery/common";
import { isExternalUrl, useExternalLink } from "../hooks/useExternalLink.js";
import { Box, Link, Typography } from "./uiParts";
import type { Components } from "react-markdown";

/**
 * `text` 中の既知ワーカー表示名（#1163）をワーカープロフィールへの `RouterLink` に変換する。
 * ユーザーが `@名前` を入力するメンションは成立しない（ADR-0020）ため、AI 生成本文中に
 * 自然に現れる表示名を検出してリンク化する。マッチが無ければ元の文字列をそのまま返す。
 */
function renderTextWithWorkerMentions({
  text,
  workers,
}: {
  text: string;
  workers: readonly WorkerMentionCandidate[];
}): ReactNode {
  const mentions = detectWorkerMentions({ text, workers });
  if (mentions.length === 0) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  // eslint-disable-next-line max-params
  mentions.forEach((mention, index) => {
    if (mention.start > cursor) {
      nodes.push(text.slice(cursor, mention.start));
    }
    nodes.push(
      <RouterLink
        key={`worker-mention-${index}-${mention.workerId}`}
        to="/workers/$workerId"
        params={{ workerId: mention.workerId }}
        style={{ color: "inherit", textDecoration: "underline", cursor: "pointer" }}
      >
        {mention.displayName}
      </RouterLink>,
    );
    cursor = mention.end;
  });
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

/**
 * 段落・リスト項目等の直下の文字列 children にのみワーカー名検出を適用する。
 * 既に `strong` / `a` / `code` 等の要素になっている children はそのまま透過し、
 * それらの内部までは再帰的に処理しない（インライン装飾内部の誤検出を避ける・#1163）。
 */
function renderChildrenWithWorkerMentions({
  children,
  workers,
}: {
  children?: ReactNode;
  workers: readonly WorkerMentionCandidate[];
}): ReactNode {
  if (workers.length === 0 || children === undefined || children === null) {
    return children;
  }
  if (typeof children === "string") {
    return renderTextWithWorkerMentions({ text: children, workers });
  }
  if (Array.isArray(children)) {
    // eslint-disable-next-line max-params
    return children.map((child, index) =>
      typeof child === "string" ? (
        <Fragment key={index}>
          {renderTextWithWorkerMentions({ text: child, workers })}
        </Fragment>
      ) : (
        child
      ),
    );
  }
  return children;
}

/** img タグを除外したサニタイズスキーマ（インライン画像を許可しない）。 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter((tag) => tag !== "img"),
};

type MarkdownVariant = "body1" | "body2";

/**
 * `knownWorkers` 未指定時のデフォルト値。呼び出しごとに新しい配列リテラルを渡すと
 * 参照が変わり `components` の useMemo が毎回再計算されてしまうため、安定した参照を共有する。
 */
const EMPTY_KNOWN_WORKERS: readonly WorkerMentionCandidate[] = [];

interface MarkdownContentProps {
  content: string;
  /** テキスト要素のベース variant（MUI Typography 準拠）。デフォルト body1 */
  variant?: MarkdownVariant;
  /**
   * 指定時、レンダリング結果全体をこの行数で CSS line-clamp 省略表示する
   * （PostCard の truncateText 用・#1105）。
   * `-webkit-line-clamp` は単一のブロック要素内でしか行数を数えられないため、
   * 見出し・リスト・コードブロック等が混在していても正しく省略できるよう
   * `p` 個別ではなく ReactMarkdown の出力全体を包む外側コンテナに適用する。
   * 未指定時は外側コンテナを追加せず全文表示する（詳細画面用）。
   */
  clampToLines?: number;
  /**
   * 本文中の既知ワーカー表示名をプロフィール（`/workers/{id}`）への内部リンクとして
   * 検出する対象ワーカー（#1163）。未指定時（デフォルト空配列）は従来どおり検出しない。
   */
  knownWorkers?: readonly WorkerMentionCandidate[];
}

/**
 * Markdown コンテンツコンポーネント。
 * react-markdown の components マッピングで MUI コンポーネントを使い、
 * Slack 風テーマと整合させる。
 */
export const MarkdownContent = ({
  content,
  variant = "body1",
  clampToLines,
  knownWorkers = EMPTY_KNOWN_WORKERS,
}: MarkdownContentProps): ReactElement => {
  const { openExternalLink } = useExternalLink();

  // components オブジェクトは variant / knownWorkers が変わったときだけ再生成する
  const components: Components = useMemo(() => {
    return ({
    // 段落: Typography で描画（variant は呼び出し元から渡す）
    p: ({ children }: { children?: ReactNode }) => (
      <Typography variant={variant} component="p" sx={{ mb: 0.5, mt: 0 }}>
        {renderChildrenWithWorkerMentions({ children, workers: knownWorkers })}
      </Typography>
    ),

    // 見出し: テーマ整合のため小さめに統一（h1〜h3 は h6 相当、h4〜h6 はそのまま）
    h1: ({ children }: { children?: ReactNode }) => (
      <Typography variant="h6" component="h1" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
        {children}
      </Typography>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mt: 1, mb: 0.5 }}>
        {children}
      </Typography>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, mt: 0.5, mb: 0.5 }}>
        {children}
      </Typography>
    ),
    h4: ({ children }: { children?: ReactNode }) => (
      <Typography variant="subtitle2" component="h4" sx={{ fontWeight: 600, mt: 0.5, mb: 0.5 }}>
        {children}
      </Typography>
    ),
    h5: ({ children }: { children?: ReactNode }) => (
      <Typography variant="subtitle2" component="h5" sx={{ fontWeight: 600, mt: 0.5, mb: 0.5 }}>
        {children}
      </Typography>
    ),
    h6: ({ children }: { children?: ReactNode }) => (
      <Typography variant="subtitle2" component="h6" sx={{ fontWeight: 600, mt: 0.5, mb: 0.5 }}>
        {children}
      </Typography>
    ),

    // インラインコード / コードブロック内の code 要素。
    // react-markdown v10 では `inline` prop が廃止されたため、
    // className（language-xxx）がない = インラインコードとして判定する。
    code: ({
      className,
      children,
    }: {
      className?: string;
      children?: ReactNode;
    }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <Box
            component="code"
            sx={{
              fontFamily: "monospace",
              bgcolor: "action.hover",
              borderRadius: 0.5,
              px: 0.5,
              py: 0.125,
              fontSize: "0.875em",
            }}
          >
            {children}
          </Box>
        );
      }
      // ブロックコードは pre 内に入るためシンプルに
      return (
        <Box
          component="code"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.875em",
            display: "block",
          }}
        >
          {children}
        </Box>
      );
    },

    // コードブロック（pre > code）
    pre: ({ children }: { children?: ReactNode }) => (
      <Box
        component="pre"
        sx={{
          bgcolor: "action.hover",
          borderRadius: 1,
          p: 1.5,
          overflowX: "auto",
          mt: 0.5,
          mb: 0.5,
          fontSize: "0.875em",
          fontFamily: "monospace",
        }}
      >
        {children}
      </Box>
    ),

    // 引用
    blockquote: ({ children }: { children?: ReactNode }) => (
      <Box
        component="blockquote"
        sx={{
          borderLeft: "3px solid",
          borderColor: "divider",
          pl: 1.5,
          ml: 0,
          mr: 0,
          my: 0.5,
          color: "text.secondary",
        }}
      >
        {renderChildrenWithWorkerMentions({ children, workers: knownWorkers })}
      </Box>
    ),

    // リスト
    ul: ({ children }: { children?: ReactNode }) => (
      <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 0.5 }}>
        {children}
      </Box>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <Box component="ol" sx={{ pl: 2, mt: 0.5, mb: 0.5 }}>
        {children}
      </Box>
    ),
    li: ({ children }: { children?: ReactNode }) => (
      <Box component="li" sx={{ mb: 0.25 }}>
        {renderChildrenWithWorkerMentions({ children, workers: knownWorkers })}
      </Box>
    ),

    // リンク: 外部リンクの左クリックは確認モーダル経由で開く（#661）。
    // href + target="_blank" は中クリック / Ctrl+クリック等ネイティブ操作の後退動作として保持する。
    // 相対パス・同一オリジン URL は外部リンク判定外のため preventDefault せずブラウザの
    // デフォルト動作（href に従ったナビゲーション）に委ねる。
    a: ({
      href,
      children,
    }: {
      href?: string;
      children?: ReactNode;
    }) => (
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (href && isExternalUrl(href)) {
            e.preventDefault();
            openExternalLink(href);
          }
        }}
        underline="hover"
        sx={{ cursor: "pointer" }}
      >
        {children}
      </Link>
    ),

    // テーブル
    table: ({ children }: { children?: ReactNode }) => (
      <Box
        component="table"
        sx={{
          borderCollapse: "collapse",
          width: "100%",
          mt: 0.5,
          mb: 0.5,
          fontSize: "0.875em",
        }}
      >
        {children}
      </Box>
    ),
    thead: ({ children }: { children?: ReactNode }) => (
      <Box component="thead">{children}</Box>
    ),
    tbody: ({ children }: { children?: ReactNode }) => (
      <Box component="tbody">{children}</Box>
    ),
    tr: ({ children }: { children?: ReactNode }) => (
      <Box component="tr">{children}</Box>
    ),
    th: ({ children }: { children?: ReactNode }) => (
      <Box
        component="th"
        sx={{
          border: "1px solid",
          borderColor: "divider",
          p: 0.5,
          fontWeight: 600,
          bgcolor: "action.hover",
          textAlign: "left",
        }}
      >
        {renderChildrenWithWorkerMentions({ children, workers: knownWorkers })}
      </Box>
    ),
    td: ({ children }: { children?: ReactNode }) => (
      <Box
        component="td"
        sx={{
          border: "1px solid",
          borderColor: "divider",
          p: 0.5,
        }}
      >
        {renderChildrenWithWorkerMentions({ children, workers: knownWorkers })}
      </Box>
    ),

    // 画像: img タグをサニタイズで除去しているが、念のためコンポーネントでもフォールバック
    // src を alt テキストのリンクとして表示する（外部リンク確認モーダル経由・#661）
    img: ({
      src,
      alt,
    }: {
      src?: string;
      alt?: string;
    }) => {
      const label = alt ?? src ?? "画像";
      if (src) {
        const capturedSrc = src;
        return (
          <Link
            href={capturedSrc}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              openExternalLink(capturedSrc);
            }}
            sx={{ cursor: "pointer" }}
          >
            [{label}]
          </Link>
        );
      }
      return <span>[{label}]</span>;
    },
  });
  }, [variant, openExternalLink, knownWorkers]);

  const markdown = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );

  if (clampToLines === undefined) {
    return markdown;
  }

  // 見出し・リスト・コードブロック等が混在していても出力全体を 1 つのブロックとして
  // クランプするため、ReactMarkdown の出力全体を外側コンテナで包む（#1105）。
  return (
    <Box
      sx={{
        display: "-webkit-box",
        WebkitLineClamp: clampToLines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {markdown}
    </Box>
  );
};
