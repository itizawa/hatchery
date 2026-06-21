import { Avatar, Box, Typography } from "./uiParts";
import type { ReactElement } from "react";
import type { Comment } from "../api/communities.js";
import { extractFirstUrl } from "@hatchery/common";
import { OgpCard } from "./OgpCard.js";
import { PostedTime } from "./PostedTime.js";
import { VoteControl } from "./VoteControl.js";
import { ShareButton } from "./ShareButton.js";
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
  /** 子コメントを持つかどうか。true のときアバター下に縦線を描画する（#796）。 */
  hasChildren?: boolean;
  /**
   * 共有ボタン用の postId（#775）。指定時のみ ShareButton を表示する。
   * shareUrl は内部で `${origin}/posts/${postId}#comment-${comment.id}` に組み立てる。
   */
  postId?: string;
}

/**
 * コメントカード。本文・author・score・up/down vote ボタンを表示する（ADR-0019 / ADR-0025）。
 * コメント入力欄は持たない（ユーザーはコメントしない・ADR-0020）。
 * #520: Reddit 風コネクター線（スレッドライン）+ 深さに応じたインデントに対応。
 * #775: postId 指定時、アクションバーに ShareButton を追加する。
 */
export const CommentCard = ({
  comment,
  onVote,
  currentVote = null,
  voteDisabled = false,
  depth = 0,
  children = null,
  hasChildren = false,
  postId,
}: CommentCardProps): ReactElement => {
  const clampedDepth = Math.min(depth, MAX_COMMENT_DEPTH);
  const indentLeft = clampedDepth * INDENT_PER_DEPTH;

  // 本文の先頭 URL（OGP カード展開に使用・#515）。
  const firstUrl = extractFirstUrl(comment.text);

  // 共有ボタン用 URL / タイトル（#775）。postId が渡された場合のみ組み立てる。
  const shareUrl = postId ? `${window.location.origin}/posts/${postId}#comment-${comment.id}` : undefined;
  // [...text] でコードポイント単位に分割し、サロゲートペア（絵文字等）の途中で切れるのを防ぐ。
  const commentChars = shareUrl ? [...comment.text] : [];
  const shareTitle = shareUrl
    ? commentChars.slice(0, 50).join("") + (commentChars.length > 50 ? "…" : "")
    : "";

  return (
    <Box
      sx={{
        pl: `16px`,
        position: "relative",
      }}
    >
      {/* L 字コネクター（#746）: アバター底辺（30px）まで左偈線を引き、縦線と纙目なく接続する。 */}
      {depth > 0 && (
        <Box
          data-testid="comment-l-connector"
          aria-hidden="true"
          sx={{
            position: "absolute",
            left: `12px`,
            top: "0px",
            height: "20px",
            width: "16px",
            borderLeft: "2px solid",
            borderBottom: "2px solid",
            borderColor: CONNECTOR_COLOR,
            borderRadius: "0 0 0 4px",
          }}
        />
      )}

      {/* コメント本体: 縦線はこのブロック内に閉じ、子コメントまで伸ばさない */}
      <Box sx={{ position: "relative" }}>
        {hasChildren && (
          <Box
            data-testid="comment-avatar-connector"
            data-left={String(indentLeft + 12)}
            aria-hidden="true"
            sx={{
              position: "absolute",
              left: `12px`,
              top: "30px",
              bottom: 0,
              width: "2px",
              bgcolor: CONNECTOR_COLOR,
              borderRadius: "1px",
            }}
          />
        )}

        {/* アバター列 + コンテンツ列 を flex で横並び */}
        <Box sx={{ display: "flex", py: 0.75 }}>
          {/* 左列: アバター（コネクターが重ならないよう本文と分離） */}
          <Box sx={{ flexShrink: 0, width: 24, mr: 1 }}>
            {comment.author_worker && (
              <Avatar
                src={comment.author_worker.image_url ?? undefined}
                alt={comment.author_worker.display_name}
                sx={{ width: 24, height: 24, fontSize: "0.7rem" }}
              >
                {comment.author_worker.display_name.charAt(0).toUpperCase()}
              </Avatar>
            )}
          </Box>

          {/* 右列: 著者名・投稿時刻・本文・アクション */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
              {comment.author_worker ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {comment.author_worker.display_name}
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {comment.author}
                </Typography>
              )}
              <PostedTime createdAt={comment.created_at} />
            </Box>
            <MarkdownContent content={comment.text} variant="body2" />
            {firstUrl && <OgpCard url={firstUrl} />}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              <VoteControl
                score={comment.score}
                upCount={comment.up_count}
                onVote={onVote}
                currentVote={currentVote}
                disabled={voteDisabled}
              />
              {shareUrl && <ShareButton shareUrl={shareUrl} shareTitle={shareTitle} />}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 子コメント */}
      {children}
    </Box>
  );
};
