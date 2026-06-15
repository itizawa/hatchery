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
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { Box, Link, Typography } from "./uiParts";
import type { Components } from "react-markdown";

/** img タグを除外したサニタイズスキーマ（インライン画像を許可しない）。 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter((tag) => tag !== "img"),
};

type MarkdownVariant = "body1" | "body2";

interface MarkdownContentProps {
  content: string;
  /** テキスト要素のベース variant（MUI Typography 準拠）。デフォルト body1 */
  variant?: MarkdownVariant;
  /**
   * 段落（p）要素に追加する MUI sx スタイル。
   * PostCard の truncateText（line-clamp）等、外部からスタイルを注入する用途で使う。
   */
  paragraphSx?: Record<string, unknown>;
}

/**
 * Markdown コンテンツコンポーネント。
 * react-markdown の components マッピングで MUI コンポーネントを使い、
 * Slack 風テーマと整合させる。
 */
export const MarkdownContent = ({
  content,
  variant = "body1",
  paragraphSx,
}: MarkdownContentProps): ReactElement => {
  // components オブジェクトは variant / paragraphSx が変わったときだけ再生成する
  const components: Components = useMemo(() => {
    const pSx = paragraphSx ? { mb: 0.5, mt: 0, ...paragraphSx } : { mb: 0.5, mt: 0 };
    return ({
    // 段落: Typography で描画（variant は呼び出し元から渡す）
    p: ({ children }: { children?: ReactNode }) => (
      <Typography variant={variant} component="p" sx={pSx}>
        {children}
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
        {children}
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
        {children}
      </Box>
    ),

    // リンク: 新規タブで開く + セキュリティ対策
    a: ({
      href,
      children,
    }: {
      href?: string;
      children?: ReactNode;
    }) => (
      <Link href={href} target="_blank" rel="noopener noreferrer" underline="hover">
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
        {children}
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
        {children}
      </Box>
    ),

    // 画像: img タグをサニタイズで除去しているが、念のためコンポーネントでもフォールバック
    // src を alt テキストのリンクとして表示する
    img: ({
      src,
      alt,
    }: {
      src?: string;
      alt?: string;
    }) => {
      const label = alt ?? src ?? "画像";
      if (src) {
        return (
          <Link href={src} target="_blank" rel="noopener noreferrer">
            [{label}]
          </Link>
        );
      }
      return <span>[{label}]</span>;
    },
  });
  }, [variant, paragraphSx]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
};
