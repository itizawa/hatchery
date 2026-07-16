import { Box, Chip, IconButton, Link, Skeleton, Tooltip, Typography } from "./uiParts";
import type { ReactElement } from "react";
import type React from "react";
import type { Post } from "../api/communities.js";
import { extractFirstUrl } from "@hatchery/common";
import type { WorkerMentionCandidate } from "@hatchery/common";
import { AuthorByline } from "./AuthorByline.js";
import { OgpCard } from "./OgpCard.js";
import { PostedTime } from "./PostedTime.js";
import { VoteControl } from "./VoteControl.js";
import { ShareButton } from "./ShareButton.js";
import { MarkdownContent } from "./MarkdownContent.js";
import type { VoteDirection } from "./VoteControl.js";
import CommentRounded from "@mui/icons-material/CommentRounded";
import PushPinRounded from "@mui/icons-material/PushPinRounded";
import { SLACK_COLORS } from "../theme.js";

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
      upVoteDisabled?: boolean;
      downVoteDisabled?: boolean;
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
      /** 購読コミュニティの前回訪問後に投稿された新着投稿を示すラベル（#935）。 */
      isNew?: boolean;
      /** admin による pin 状態を示す「固定」ラベル（#1089）。 */
      isPinned?: boolean;
      /**
       * pin / unpin 操作ボタンのクリック時のコールバック（#1089）。
       * 指定時のみボタンを表示する（admin ユーザーのみに渡す想定）。
       */
      onTogglePin?: () => void;
      /**
       * ワーカー名・アバタークリック時のコールバック（#929）。指定時は AuthorByline をクリック可能にし、
       * ワーカープロフィールページへ遷移する RouterLink に切り替える。
       */
      onWorkerClick?: (e: React.MouseEvent) => void;
      /**
       * 本文中の既知ワーカー表示名をプロフィールへの自動リンクとして検出する対象（#1163）。
       * 未指定時は検出しない（後方互換）。
       */
      knownWorkers?: readonly WorkerMentionCandidate[];
      /**
       * カード表示（デフォルト）またはフラットリスト表示を選択する（#834）。
       * "card": 現行スタイル（border + bgcolor: background.paper + borderRadius + mb）。
       * "list": 外枠カードスタイルを除去し、border-bottom のみの区切り線スタイル。
       */
      variant?: "card" | "list";
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

/** 外枠 Box のスタイル — card バリアント（デフォルト / loading Skeleton でも使用）。 */
const cardBoxSx = {
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1,
  p: 2,
  bgcolor: "background.paper",
  mb: 1,
} as const;

/** 外枠 Box のスタイル — list バリアント（フラットリスト・#834）。 */
const listBoxSx = {
  borderBottom: "1px solid",
  borderColor: "divider",
  p: 2,
} as const;

/** タイトル横の小さいラベル Chip 共通スタイル（New / 固定・#935 / #1089・まとめ #1165 と共有）。 */
export const feedBadgeChipSx = {
  fontWeight: 600,
  height: 20,
  borderRadius: "4px",
  "& .MuiChip-label": { px: "6px", fontSize: "0.7rem" },
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
      <Box sx={cardBoxSx}>
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
    upVoteDisabled = false,
    downVoteDisabled = false,
    voteStopPropagation = false,
    postUrl,
    truncateText = false,
    community,
    onCommunityClick,
    onCommentClick,
    onWorkerClick,
    knownWorkers,
    variant = "card",
    isNew = false,
    isPinned = false,
    onTogglePin,
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
    <Box sx={variant === "list" ? listBoxSx : cardBoxSx} data-variant={variant}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
        <Typography
          variant="h6"
          component="h3"
          sx={{ fontWeight: 600 }}
        >
          {post.title}
        </Typography>
        {isNew && (
          <Chip
            label="New"
            size="small"
            sx={{ ...feedBadgeChipSx, bgcolor: SLACK_COLORS.blue, color: "#fff" }}
          />
        )}
        {isPinned && (
          <Chip
            icon={<PushPinRounded sx={{ fontSize: "0.8rem !important" }} />}
            label="固定"
            size="small"
            variant="outlined"
            sx={feedBadgeChipSx}
          />
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
        {community && <CommunityByline community={community} onClick={onCommunityClick} />}
        <AuthorByline author={post.author} authorWorker={post.author_worker} onWorkerClick={onWorkerClick} />
        <PostedTime createdAt={post.created_at} />
      </Box>
      <MarkdownContent
        content={post.text}
        variant="body2"
        clampToLines={truncateText ? 3 : undefined}
        knownWorkers={knownWorkers}
      />
      {firstUrl && <OgpCard url={firstUrl} />}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
        <Box onClick={handleVoteClick}>
          <VoteControl
            score={post.score}
            onVote={onVote}
            currentVote={currentVote}
            upDisabled={upVoteDisabled}
            downDisabled={downVoteDisabled}
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
        {postUrl && (
          <Box onClick={handleVoteClick}>
            <ShareButton shareUrl={postUrl} shareTitle={post.title} />
          </Box>
        )}
        {onTogglePin && (
          <Box onClick={handleVoteClick}>
            <Tooltip title={isPinned ? "固定を解除する" : "固定する"}>
              <IconButton
                size="small"
                aria-label={isPinned ? "固定を解除する" : "固定する"}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onTogglePin();
                }}
                sx={{ color: isPinned ? SLACK_COLORS.blue : "text.secondary" }}
              >
                <PushPinRounded fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
};
