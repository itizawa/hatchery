import { Box, Chip, Link, Skeleton, Typography } from "./uiParts";
import type { ReactElement } from "react";
import type React from "react";
import type { Post } from "../api/communities.js";
import { extractFirstUrl } from "@hatchery/common";
import { AuthorByline } from "./AuthorByline.js";
import { OgpCard } from "./OgpCard.js";
import { PostedTime } from "./PostedTime.js";
import { VoteControl } from "./VoteControl.js";
import { ShareButton } from "./ShareButton.js";
import { MarkdownContent } from "./MarkdownContent.js";
import type { VoteDirection } from "./VoteControl.js";
import CommentRounded from "@mui/icons-material/CommentRounded";

/** 投稿カードに表示する所属コミュニティの最小情報（#503）。 */
export interface PostCardCommunity {
  slug: string;
  name: string;
}

/**
 * PostCard の props。loading=true のとき post / onVote 等は不要（#807）。
 * discriminated union で loading 時にデータ系 prop を必須にしない形にする。
 */
type PostCardProps =
  | {
      /** loading={true} のとき Skeleton を表示する。post / onVote 等は不要。 */
      loading: true;
    }
  | {
      loading?: false;
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
      /** コメント数 Chip クリック時のコールバック。指定時はクリック可能になる。 */
      onCommentClick?: () => void;
    };

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

/** 外枠 Box のスタイル（loading / 通常で共通）。 */
const outerBoxSx = {
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1,
  p: 2,
  bgcolor: "background.paper",
  mb: 1,
} as const;

/**
 * 投稿カード。タイトル・本文・author・score・up/down vote ボタンを表示する（ADR-0019 / ADR-0025）。
 * post のアクションバー（本文下）に VoteControl・コメント数・ShareButton を横並びで配置（ADR-0025）。
 * 投稿入力欄は持たない（ユーザーは投稿しない・ADR-0020）。
 * loading={true} のとき、実 UI と同一の外枠 Box の中に Skeleton を描画する（#807）。
 */
export const PostCard = (props: PostCardProps): ReactElement => {
  if (props.loading) {
    return (
      <Box sx={outerBoxSx}>
        {/* タイトル相当 */}
        <Skeleton variant="text" width="70%" sx={{ mb: 0.5 }} />
        {/* byline 相当 */}
        <Skeleton variant="text" width="40%" sx={{ mb: 1 }} />
        {/* 本文相当（3 行） */}
        <Skeleton variant="text" />
        <Skeleton variant="text" />
        <Skeleton variant="text" width="80%" />
        {/* アクションバー相当 */}
        <Skeleton variant="text" width="30%" sx={{ mt: 1 }} />
      </Box>
    );
  }

  const {
    post,
    onVote,
    currentVote = null,
    voteDisabled = false,
    voteStopPropagation = false,
    postUrl,
    truncateText = false,
    community,
    onCommunityClick,
    onCommentClick,
  } = props;

  // comment_count はサーバ集計値（#500）。未指定（後方互換）は 0 として扱う。
  const commentCount = post.comment_count ?? 0;
  // 本文の先頭 URL（スレッド全文表示時のみ OGP カード展開に使用）（#515）。
  const firstUrl = truncateText ? null : extractFirstUrl(post.text);
  const handleVoteClick = voteStopPropagation
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      }
    : undefined;

  return (
    <Box sx={outerBoxSx}>
      <Typography
        variant="h6"
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
      <MarkdownContent
        content={post.text}
        variant="body2"
        paragraphSx={
          truncateText
            ? {
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : undefined
        }
      />
      {firstUrl && <OgpCard url={firstUrl} />}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
        <Box onClick={handleVoteClick}>
          <VoteControl
            score={post.score}
            upCount={post.up_count}
            onVote={onVote}
            currentVote={currentVote}
            disabled={voteDisabled}
          />
        </Box>
        <Chip
          icon={<CommentRounded />}
          label={commentCount}
          aria-label={`コメント ${commentCount} 件`}
          size="small"
          variant="outlined"
          clickable={!!onCommentClick}
          onClick={
            onCommentClick
              ? (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCommentClick();
                }
              : undefined
          }
          sx={{ height: 32, padding:"0px 6px 0px 8px",border:"none", color: "text.secondary" }}
        />
        {postUrl && <ShareButton shareUrl={postUrl} shareTitle={post.title} />}
      </Box>
    </Box>
  );
};
