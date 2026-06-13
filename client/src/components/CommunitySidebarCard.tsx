import { Box, Divider, Stack, Typography } from "./uiParts";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactElement, ReactNode } from "react";

import { ShareButton } from "./ShareButton.js";
import { SubscribeButton } from "./SubscribeButton.js";
import type { Community } from "../api/communities.js";

interface CommunitySidebarCardProps {
  community: Community;
  shareUrl: string;
  shareTitle: string;
  /** ログイン済みのときのみ true（購読ボタンの表示制御） */
  showSubscribe: boolean;
  subscribed: boolean;
  subscriptionPending: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
  /** true ならコミュニティ名を /communities/$slug へのリンクにする（PostThreadScene 用） */
  nameLink?: boolean;
  /** 追加セクション（例: 最近投稿したワーカー）。ボタン群の直前に描画する */
  children?: ReactNode;
}

/**
 * community.created_at を "YYYY年M月D日 作成" 形式（UTC 基準）にフォーマットする。
 * created_at が undefined / 空文字 / 不正日付のときは null を返し、呼び出し側で作成日行を
 * 非表示にする（「NaN年NaN月NaN日 作成」の表示を防ぐ・#477）。
 */
const formatCreatedAt = (dateStr: string | undefined): string | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日 作成`;
};

/**
 * コミュニティ詳細サイドバーカード（#370 / #390）。
 * 名前・説明・作成日・シェア/購読ボタンを表示する presentational コンポーネント。
 * CommunityScene と PostThreadScene の右サイドバーで共用する。
 */
export const CommunitySidebarCard = ({
  community,
  shareUrl,
  shareTitle,
  showSubscribe,
  subscribed,
  subscriptionPending,
  onSubscribe,
  onUnsubscribe,
  nameLink = false,
  children,
}: CommunitySidebarCardProps): ReactElement => {
  const createdAtLabel = formatCreatedAt(community.created_at);
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        p: 2,
      }}
    >
      <Typography variant="h6" component="h2" gutterBottom>
        {nameLink ? (
          <RouterLink
            to="/communities/$slug"
            params={{ slug: community.slug }}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            {community.name}
          </RouterLink>
        ) : (
          community.name
        )}
      </Typography>
      <Divider sx={{ mb: 1 }} />
      {community.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {community.description}
        </Typography>
      )}
      {createdAtLabel && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          {createdAtLabel}
        </Typography>
      )}
      {children}
      <Stack spacing={1}>
        <ShareButton shareUrl={shareUrl} shareTitle={shareTitle} />
        {showSubscribe && (
          <SubscribeButton
            subscribed={subscribed}
            onSubscribe={onSubscribe}
            onUnsubscribe={onUnsubscribe}
            disabled={subscriptionPending}
          />
        )}
      </Stack>
    </Box>
  );
};
