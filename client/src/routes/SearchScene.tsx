/**
 * 投稿全文検索ページ（/search・#751）。
 * q クエリパラメータで title / text の ILIKE 部分一致検索を行い、最大 50 件・新着順で表示する。
 */
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, CircularProgress, InputAdornment, TextField, Typography } from "../components/uiParts";
import { Link as RouterLink, useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { type ReactElement } from "react";

import { useSearchPosts } from "../api/search.js";
import { PostCard } from "../components/PostCard.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { SLACK_COLORS } from "../theme.js";

/** 検索結果一覧。q が空のとき・ヒット 0 件のとき・読込中・エラーの各状態を表示する。 */
const SearchResults = ({ q }: { q: string }): ReactElement => {
  const navigate = useNavigate();
  const { data: posts, isPending, isError } = useSearchPosts({ q });

  if (!q) {
    return (
      <Box sx={{ py: 8, textAlign: "center", color: "text.secondary" }}>
        <SearchRoundedIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
        <Typography variant="body1">キーワードを入力して投稿を検索できます。</Typography>
      </Box>
    );
  }

  if (isPending) {
    return (
      <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ py: 8, textAlign: "center", color: "text.secondary" }}>
        <Typography variant="body1">検索に失敗しました。しばらく経ってからお試しください。</Typography>
      </Box>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: "center", color: "text.secondary" }}>
        <Typography variant="body1">「{q}」に一致する投稿が見つかりませんでした。</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="caption" sx={{ color: "text.secondary", px: 2, pb: 1, display: "block" }}>
        {posts.length} 件の投稿が見つかりました
      </Typography>
      {posts.map((post) => (
        <RouterLink
          key={post.id}
          to="/posts/$postId"
          params={{ postId: post.id }}
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          <PostCard
            post={post}
            onVote={() => navigate({ to: "/posts/$postId", params: { postId: post.id } })}
            currentVote={null}
            truncateText
            voteStopPropagation
          />
        </RouterLink>
      ))}
    </Box>
  );
};

/** 投稿全文検索ページ（/search）。 */
export const SearchScene = (): ReactElement => {
  const { q: currentQ = "" } = useSearch({ from: "/search" });
  const navigate = useNavigate();

  useDocumentTitle(currentQ ? `「${currentQ}」の検索結果 - Hatchery` : "投稿を検索 - Hatchery");

  const form = useForm({
    defaultValues: { q: currentQ },
    onSubmit: ({ value }) => {
      const trimmed = value.q.trim();
      void navigate({ to: "/search", search: trimmed ? { q: trimmed } : {} });
    },
  });

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", px: 2, py: 3 }}>
      <Typography variant="h6" component="h1" sx={{ mb: 2, fontWeight: 700, color: SLACK_COLORS.sidebarText }}>
        投稿を検索
      </Typography>

      <Box
        component="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        sx={{ mb: 3 }}
      >
        <form.Field name="q">
          {(field) => (
            <TextField
              fullWidth
              placeholder="キーワードを入力..."
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              slotProps={{
                htmlInput: { maxLength: 200 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon sx={{ color: "text.secondary" }} />
                    </InputAdornment>
                  ),
                },
              }}
              size="small"
              sx={{
                bgcolor: "white",
                "& .MuiOutlinedInput-root": {
                  borderRadius: 1,
                },
              }}
            />
          )}
        </form.Field>
      </Box>

      <SearchResults q={currentQ} />
    </Box>
  );
};
