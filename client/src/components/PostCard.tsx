import { Box, Link, Typography } from "./uiParts";
import type { ReactElement } from "react";
import type React from "react";
import type { Post } from "../api/communities.js";
import { AuthorByline } from "./AuthorByline.js";
import { PostedTime } from "./PostedTime.js";
import { VoteControl } from "./VoteControl.js";
import { ShareButton } from "./ShareButton.js";
import type { VoteDirection } from "./VoteControl.js";

/** 投稿カードに表示する所属コミュニティの最小情報（#503）。 */
export interface PostCardCommunity {
  slug: string;
  name: string;
}

interface PostCardProps {
  post: Post;
  onVote: (direction: VoteDirection) => void;
  currentVote?: VoteDirection | null;
  voteDisabled?: boolean;
  /** up/down vote ボタンのクリック時に親へのイベント伝播を止め、リンクのデフォルト遷移も抑止する（RouterLink との共存に使用）。 */
  voteStopPropagation?: boolean;
  /** 共有ボタンに使う post の URL。指定時のみ ShareButton を表示する。 */
  postUrl?: string;
  /** フィード一覧での一覧性向上のため、有効時は本文を CSS line-clamp（3 行）で省略表示する。スレッド詳細では false（全文表示）。 */
  truncateText?: boolean;
  /**
   * ホームの混在フィードで「どの community の投稿か」を示す所属コミュニティ（#503）。
   * 指定時のみ byline 先頭に c/{slug} を表示する。単一コミュニティ文脈（CommunityScene 等）では渡さない。
   */
  community?: PostCardCommunity;
  /**
   * c/{slug} クリック時のハンドラ（#503）。指定時は c/{slug} をクリック可能にし、
   * 親（post スレッドへの RouterLink）への伝播・デフォルト遷移を止めてコールバックを呼ぶ。
   * 未指定時は c/{slug} をテキストのみで表示する。
   */
  onCommunityClick?: () => void;
}

/**
 * 所属コミュニティの byline（c/{slug}）。onClick 指定時はクリック可能なリンク、
 * 未指定時はテキストのみで表示する（#503）。
 */
const CommunityByline = ({
  community,
  onClick,
}: {
  community: PostCardCommunity;
  onClick?: () => void;
}): ReactElement => {
  const label = `c/${community.slug}`;
  if (!onClick) {
    return (
      <Typography variant="body2" component="span" sx={{ color: "text.secondary" }} title={community.name}>
        {label}
      </Typography>
    );
  }
  return (
    <Link
      component="button"
      type="button"
      variant="body2"
      title={community.name}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      sx={{ color: "text.secondary", textDecorationColor: "inherit", fontWeight: 600 }}
    >
      {label}
    </Link>
  );
};

/**
 * 投稿カード。タイトル・本文・author・score・up/down vote ボタンを表示する（ADR-0019 / ADR-0025）。
 * post のアクションバーに ShareButton を追加（ADR-0025）。
 * 投稿入力欄は持たない（ユーザーは投稿しない・ADR-0020）。
 */
export const PostCard = ({
  post,
  onVote,
  currentVote = null,
  voteDisabled = false,
  voteStopPropagation = false,
  postUrl,
  truncateText = false,
  community,
  onCommunityClick,
}: PostCardProps): ReactElement => {
  // comment_count はサーバ集計値（#500）。未指定（後方互換）は 0 として扱う。
  const commentCount = post.comment_count ?? 0;
  const handleVoteClick = voteStopPropagation
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      }
    : undefined;

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 2,
        bgcolor: "background.paper",
        mb: 1,
      }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <Box
          sx={{ pt: 0.5 }}
          onClick={handleVoteClick}
        >
          <VoteControl
            score={post.score}
            onVote={onVote}
            currentVote={currentVote}
            disabled={voteDisabled}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{ fontWeight: 600, mb: 0.5 }}
          >
            {post.title}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
            {community && <CommunityByline community={community} onClick={onCommunityClick} />}
            <AuthorByline author={post.author} authorWorker={post.author_worker} />
            <PostedTime createdAt={post.created_at} />
          </Box>
          <Typography
            variant="body1"
            sx={
              truncateText
                ? {
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }
                : undefined
            }
          >
            {post.text}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              component="span"
              aria-label={`コメント ${commentCount} 件`}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              <span aria-hidden="true">💬</span>
              {commentCount}
            </Typography>
            {postUrl && <ShareButton shareUrl={postUrl} shareTitle={post.title} />}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
