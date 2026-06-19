import { Box } from "./uiParts";
import type { ReactElement } from "react";
import type { Comment } from "../api/communities.js";
import { extractFirstUrl } from "@hatchery/common";
import { AuthorByline } from "./AuthorByline.js";
import { OgpCard } from "./OgpCard.js";
import { PostedTime } from "./PostedTime.js";
import { VoteControl } from "./VoteControl.js";
import { MarkdownContent } from "./MarkdownContent.js";
import type { VoteDirection } from "./VoteControl.js";

/** コネクターラインの色（MUI テーマのカラーキー）。 */
const CONNECTOR_COLOR = "divider";

/** 深さ 1 段あたりのインデント幅（px）。 */
const INDENT_PER_DEPTH = 16;

/** 最大インデント深さ。これ以上深くなっても INDENT_PER_DEPTH * MAX_DEPTH 以上には広がらない。 */
export const MAX_COMMENT_DEPTH = 6;

interface CommentCardProps {
  comment: Comment;
  onVote: (direction: VoteDirection) => void;
  currentVote?: VoteDirection | null;
  voteDisabled?: boolean;
  /** ネスト深さ（0 = トップレベル）。Reddit 風インデントに使う。#520。 */
  depth?: number;
  /** 子コメント（再帰表示用）。 */
  children?: ReactElement | null;
}

/**
 * コメントカード。本文・author・score・up/down vote ボタンを表示する（ADR-0019 / ADR-0025）。
 * コメント入力欄は持たない（ユーザーはコメントしない・ADR-0020）。
 * #520: Reddit 風コネクター線（スレッドライン）+ 深さに応じたインデントに対応。
 */
export const CommentCard = ({
  comment,
  onVote,
  currentVote = null,
  voteDisabled = false,
  depth = 0,
  children = null,
}: CommentCardProps): ReactElement => {
  const clampedDepth = Math.min(depth, MAX_COMMENT_DEPTH);
  const indentLeft = clampedDepth * INDENT_PER_DEPTH;

  // 本文の先頭 URL（OGP カード展開に使用・#515）。
  const firstUrl = extractFirstUrl(comment.text);

  return (
    <Box
      sx={{
        pl: `${indentLeft}px`,
        position: "relative",
      }}
    >
      {/* 深さ > 0 のときコネクターライン（左縦線）を描画する。 */}
      {depth > 0 && (
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            left: `${indentLeft - 8}px`,
            top: "30px",
            bottom: 0,
            width: "2px",
            bgcolor: CONNECTOR_COLOR,
            borderRadius: "1px",
          }}
        />
      )}

      {/* L 字コネクター（#746）: アバター中心まで伸びる曲線で親スレッドと接続。 */}
      {depth > 0 && (
        <Box
          data-testid="comment-l-connector"
          aria-hidden="true"
          sx={{
            position: "absolute",
            left: `${indentLeft - 8}px`,
            top: 0,
            height: "18px",
            width: "16px",
            borderLeft: "2px solid",
            borderBottom: "2px solid",
            borderColor: CONNECTOR_COLOR,
            borderRadius: "0 0 0 4px",
          }}
        />
      )}

      {/* コメント本体 */}
      <Box
        sx={{
          py: 0.75,
          pl: depth > 0 ? 1 : 0,
        }}
      >
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}
        >
          <AuthorByline author={comment.author} authorWorker={comment.author_worker} />
          <PostedTime createdAt={comment.created_at} />
        </Box>
        <MarkdownContent content={comment.text} variant="body2" />
        {firstUrl && <OgpCard url={firstUrl} />}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
          <VoteControl
            score={comment.score}
            onVote={onVote}
            currentVote={currentVote}
            disabled={voteDisabled}
          />
        </Box>
      </Box>

      {/* 子コメント */}
      {children}
    </Box>
  );
};
