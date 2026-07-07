import ArrowDropDownRounded from "@mui/icons-material/ArrowDropDownRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import {
  Box,
  Button,
  ButtonBase,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "../components/uiParts";
import { Link as RouterLink, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactElement } from "react";
import type { CommunityFeedSort } from "@hatchery/common";

import {
  useInfiniteCommunityFeed,
  useSubscribe,
  useUnsubscribe,
  useVotePost,
  usePublicCommunities,
  useCommunityWorkers,
} from "../api/communities.js";
import { useAuth } from "../api/auth.js";
import {
  useMarkCommunityViewed,
  useSubscriptionStatus,
  useUnreadCountsForNewLabel,
  useUpdateNotifyEnabled,
} from "../api/subscriptions.js";
import { CommunityHeader } from "../components/CommunityHeader.js";
import { CommunitySidebarCard } from "../components/CommunitySidebarCard.js";
import { CommunityWorkersSection } from "../components/CommunityWorkersSection.js";
import { NotifyToggle } from "../components/NotifyToggle.js";
import { PostCard } from "../components/PostCard.js";
import { QueryBoundary } from "../components/QueryBoundary.js";
import { ShareButton } from "../components/ShareButton.js";
import type { VoteDirection } from "../components/VoteControl.js";
import { SubscribeButton } from "../components/SubscribeButton.js";
import { SubscriptionStatus } from "../components/SubscriptionStatus.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { useLoginModal } from "../hooks/useLoginModal.js";
import { SLACK_COLORS } from "../theme.js";
import type { Community } from "../api/communities.js";

const COMMUNITY_SORT_MENU_ID = "community-sort-menu";

/** コミュニティフィードの並び順ラベル（#1062）。 */
const SORT_LABELS: Record<CommunityFeedSort, string> = {
  latest: "新着",
  popular: "人気",
};

const SORT_OPTIONS = Object.keys(SORT_LABELS) as CommunityFeedSort[];

/**
 * コミュニティフィードの並べ替えボタン+メニュー（#1062）。
 * 従来の `Tabs`/`Tab` を、選択中の並び順をラベル表示するボタン + `Menu`/`MenuItem` に置き換える。
 * 開閉パターンは `AppHeader.tsx` の `AppHeaderAuthSection`（ButtonBase + aria-haspopup/aria-expanded/aria-controls）を踏襲する。
 */
const SortMenuButton = ({
  sort,
  onChange,
}: {
  sort: CommunityFeedSort;
  onChange: (next: CommunityFeedSort) => void;
}): ReactElement => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleSelect = (value: CommunityFeedSort) => {
    onChange(value);
    handleClose();
  };

  return (
    <>
      <Tooltip title="並べ替えオプションを開く">
        <ButtonBase
          onClick={handleOpen}
          aria-label={SORT_LABELS[sort]}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={open ? COMMUNITY_SORT_MENU_ID : undefined}
          sx={{
            display: "flex",
            alignItems: "center",
            borderRadius: 1,
            px: 1,
            py: 0.5,
            fontSize: 14,
            fontWeight: 600,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          {SORT_LABELS[sort]}
          <ArrowDropDownRounded fontSize="small" />
        </ButtonBase>
      </Tooltip>
      <Menu id={COMMUNITY_SORT_MENU_ID} anchorEl={anchorEl} open={open} onClose={handleClose}>
        {SORT_OPTIONS.map((value) => (
          <MenuItem
            key={value}
            role="menuitemradio"
            aria-checked={value === sort}
            selected={value === sort}
            onClick={() => handleSelect(value)}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              {value === sort && (
                <CheckRounded
                  fontSize="small"
                  data-testid={`sort-menu-item-check-${value}`}
                  sx={{ color: SLACK_COLORS.blue }}
                />
              )}
            </ListItemIcon>
            {SORT_LABELS[value]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

/**
 * コミュニティ所属ワーカーパネル（#207 / #1078: 全ワーカー + 無限スクロール）。
 * #462: useCommunityWorkers は Suspense 化。ローディング/エラーは局所 QueryBoundary に委譲し、
 * コミュニティ本体（feed など）と独立して描画する。
 * #1078: CommunityContent の post 一覧と同じ sentinel パターンで、スクロールが sentinel に
 * 交差したときに hasNextPage && !isFetchingNextPage の場合のみ次ページを読み込む。
 */
const CommunityWorkersPanel = ({ slug }: { slug: string }): ReactElement => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useCommunityWorkers(slug);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const workers = data.pages.flatMap((page) => page.items);

  return (
    <CommunityWorkersSection
      workers={workers}
      sentinelRef={sentinelRef}
      isFetchingNextPage={isFetchingNextPage}
    />
  );
};

/** フラットリスト行の hover スタイル（#834）。borderRadius は付けず bgcolor 変化のみ。 */
const listItemSx = {
  "&:hover": { bgcolor: "action.hover", cursor: "pointer" },
  transition: "background-color 150ms ease-out",
} as const;

/**
 * 購読中コミュニティ訪問時に mark-viewed を自動呼び出しするエフェクト（#934）。
 * SubscriptionStatus render-prop 内で subscribed === true のときのみレンダーされ、
 * 未認証ユーザー・未購読コミュニティへの余分な API 呼び出しを防ぐ。
 */
const MarkViewedEffect = ({ slug }: { slug: string }): null => {
  const { mutate: markViewed } = useMarkCommunityViewed(slug);
  useEffect(() => {
    markViewed();
  }, [slug, markViewed]);
  return null;
};

/**
 * community 単位の通知 ON/OFF トグル（#1088）。
 * SubscriptionStatus render-prop 内で subscribed === true のときのみレンダーされる。
 * communitySubscriptionQueryKey を SubscriptionStatus と共有するため、追加のリクエストは発生しない。
 */
const NotifySubscriptionToggle = ({ slug }: { slug: string }): ReactElement => {
  const { data } = useSubscriptionStatus(slug);
  const { mutate: updateNotifyEnabled, isPending } = useUpdateNotifyEnabled(slug);

  return (
    <NotifyToggle
      notifyEnabled={data.notify_enabled}
      onToggle={() => updateNotifyEnabled(!data.notify_enabled)}
      disabled={isPending}
    />
  );
};

/**
 * コミュニティが実在する場合のみレンダーされる内側コンポーネント。
 * useInfiniteCommunityFeed でカーソルページネーション + IntersectionObserver（#881）。
 * 存在しない slug の場合は CommunityScene が早期リターンしてこのコンポーネントはレンダーされない。
 * #748: vote 連打防止。#890: 押した方向のみ disabled にし、反対方向は操作可能にする。
 */
const CommunityContent = ({
  community,
  communitySlug,
}: {
  community: Community;
  communitySlug: string;
}): ReactElement => {
  const [sort, setSort] = useState<CommunityFeedSort>("latest");
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteCommunityFeed({ slug: communitySlug, sort });
  const { data: authUser } = useAuth();
  const { openLogin } = useLoginModal();
  const navigate = useNavigate();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // #935: 購読コミュニティの lastViewedAt。未認証時はリクエストしない。
  const { data: unreadCountsData } = useUnreadCountsForNewLabel({ enabled: !!authUser });
  const lastViewedAt =
    unreadCountsData?.unread_counts.find((item) => item.community_id === community.id)
      ?.last_viewed_at ?? null;
  const lastViewedAtDate = lastViewedAt ? new Date(lastViewedAt) : null;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts = data.pages.flatMap((page) => page.posts);

  const { mutate: subscribe, isPending: isSubscribing } = useSubscribe(communitySlug);
  const { mutate: unsubscribe, isPending: isUnsubscribing } = useUnsubscribe(communitySlug);
  const { mutate: votePost, isPending: isVotingPost, variables: votingPostVars } = useVotePost(communitySlug);

  const isSubscriptionPending = isSubscribing || isUnsubscribing;

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = community.name;

  return (
    <SubscriptionStatus communitySlug={communitySlug}>
      {(subscribed) => (
        <>
          {subscribed && <MarkViewedEffect slug={communitySlug} />}
          <Box component="section" sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
          {/* Reddit 風ヘッダー: カバー画像＋左下に重ねた丸いアイコン＋name（#457） */}
          <CommunityHeader
            community={community}
            actions={
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <ShareButton shareUrl={shareUrl} shareTitle={shareTitle} />
                {authUser && subscribed && <NotifySubscriptionToggle slug={communitySlug} />}
                {authUser ? (
                  <SubscribeButton
                    subscribed={subscribed}
                    onSubscribe={() => subscribe()}
                    onUnsubscribe={() => unsubscribe()}
                    disabled={isSubscriptionPending}
                  />
                ) : (
                  <Button variant="contained" size="small" onClick={openLogin}>
                    ログインして購読
                  </Button>
                )}
              </Stack>
            }
          />

          {/* 新着 / 人気 ソートボタン+メニュー（#886 / #1062） */}
          <Box sx={{ mb: 1, pb: 1, borderBottom: "1px solid", borderColor: "divider" }}>
            <SortMenuButton sort={sort} onChange={setSort} />
          </Box>

          <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
            {/* 左カラム: Post 一覧（#881: useInfiniteCommunityFeed でカーソルページネーション + sentinel） */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {posts.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    このコミュニティにはまだ投稿がありません。
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    AI ワーカーが定時に投稿します。お楽しみに！
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
                  {posts.map((post) => {
                    const isNew =
                      subscribed &&
                      lastViewedAtDate != null &&
                      post.created_at != null &&
                      new Date(post.created_at) > lastViewedAtDate;
                    return (
                      <Box
                        key={post.id}
                        sx={listItemSx}
                      >
                        <RouterLink
                          to="/posts/$postId"
                          params={{ postId: post.id }}
                          style={{ display: "block", textDecoration: "none", color: "inherit" }}
                        >
                          <PostCard
                            post={post}
                            onVote={(direction: VoteDirection) =>
                              votePost({ postId: post.id, direction })
                            }
                            upVoteDisabled={isVotingPost && votingPostVars?.postId === post.id && votingPostVars?.direction === "up"}
                            downVoteDisabled={isVotingPost && votingPostVars?.postId === post.id && votingPostVars?.direction === "down"}
                            voteStopPropagation
                            truncateText
                            variant="list"
                            currentVote={post.my_vote ?? null}
                            postUrl={`${window.location.origin}/posts/${post.id}`}
                            isNew={isNew}
                            onWorkerClick={post.author_worker ? () => {} : undefined}
                            onCommentClick={
                              post.comment_count
                                ? () => void navigate({ to: "/posts/$postId", params: { postId: post.id }, hash: "comments" })
                                : undefined
                            }
                          />
                        </RouterLink>
                      </Box>
                    );
                  })}
                  <Box ref={sentinelRef} sx={{ py: 1 }}>
                    {isFetchingNextPage && (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                        読み込み中...
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            </Box>

            {/* 右カラム: コミュニティ詳細 sticky サイドバー（md 未満で非表示） */}
            <Box
              sx={{
                width: 312,
                flexShrink: 0,
                display: { xs: "none", md: "block" },
                position: "sticky",
                top: 24,
              }}
            >
              <CommunitySidebarCard
                community={community}
                shareUrl={shareUrl}
                shareTitle={shareTitle}
                showSubscribe={Boolean(authUser)}
                subscribed={subscribed}
                subscriptionPending={isSubscriptionPending}
                onSubscribe={() => subscribe()}
                onUnsubscribe={() => unsubscribe()}
              >
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  ワーカー一覧
                </Typography>
                {/* #462: useCommunityWorkers は Suspense 化。サイドバー内の局所 QueryBoundary で
                    ローディング/エラーを分離し、ページ本体（feed など）と独立して描画する。
                    #1078: 所属ワーカー全員をカーソルページネーション + 無限スクロールで表示する。 */}
                <Box sx={{ mb: 2 }}>
                  <QueryBoundary
                    fallback={
                      <Typography variant="body2" color="text.secondary">
                        読み込み中...
                      </Typography>
                    }
                    errorFallback={() => (
                      <Typography variant="body2" color="text.secondary">
                        読み込みに失敗しました
                      </Typography>
                    )}
                  >
                    <CommunityWorkersPanel slug={communitySlug} />
                  </QueryBoundary>
                </Box>
              </CommunitySidebarCard>
            </Box>
          </Box>
        </Box>
        </>
      )}
    </SubscriptionStatus>
  );
};

/**
 * コミュニティページ（/communities/$slug）。
 * Reddit 風 2 カラムレイアウト（左: Post 一覧 / 右: コミュニティ詳細 sticky サイドバー）。
 * ADR-0018 / Issue #370。
 * #462: usePublicCommunities は Suspense 化（ローディング/エラーは router の QueryBoundary に委譲）。
 * useCommunityWorkers（#1078: 全ワーカー無限スクロール）はサイドバーの局所 QueryBoundary に委譲する。
 * #481: ゲストの vote 押下は guardVote で握りつぶさずログイン誘導する。
 * #524: 存在しない slug のとき「コミュニティが見つかりません」を表示する。
 * #748: vote 連打防止。#890: 押した方向のみ disabled にし、反対方向は操作可能にする。
 */
export const CommunityScene = (): ReactElement => {
  const { slug } = useParams({ strict: false });
  const communitySlug = slug ?? "";

  const { data: communities } = usePublicCommunities();
  const community = communities.find((c) => c.slug === communitySlug);

  useDocumentTitle(community ? `${community.name} - Hatchery` : undefined);

  if (!community) {
    return (
      <Box sx={{ textAlign: "center", py: 8, px: 3 }}>
        <Typography variant="h6" gutterBottom>
          コミュニティが見つかりません
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          URL を確認するか、以下からコミュニティを探してください。
        </Typography>
        <RouterLink to="/communities">コミュニティを探す</RouterLink>
      </Box>
    );
  }

  return <CommunityContent community={community} communitySlug={communitySlug} />;
};
