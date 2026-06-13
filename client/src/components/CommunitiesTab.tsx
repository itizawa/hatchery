/**
 * 管理画面コミュニティタブ（#310）。
 * admin が community の作成・編集・一覧表示を行う。
 * フォームは @tanstack/react-form を使用（CLAUDE.md フォーム規約）。
 */
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "./uiParts";

import { useForm } from "@tanstack/react-form";
import { type ReactElement, useState } from "react";

import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
  COMMUNITY_SLUG_MAX_LENGTH,
  COMMUNITY_SLUG_REGEX,
} from "@hatchery/common";
import type { Community, CreateCommunityInput, UpdateCommunityInput } from "@hatchery/common";
import { useCommunities, useCreateCommunity, useUpdateCommunity } from "../api/communities.js";
import { CommunityImageUpload } from "./CommunityImageUpload.js";
import { QueryBoundary } from "./QueryBoundary.js";

/** コミュニティ作成フォーム。 */
function CreateCommunityForm(): ReactElement {
  const createMutation = useCreateCommunity();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { slug: "", name: "", description: "" } as CreateCommunityInput,
    onSubmit: async ({ value }) => {
      setErrorMsg(null);
      try {
        await createMutation.mutateAsync(value);
        form.reset();
        setSnackbarOpen(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "作成に失敗しました";
        setErrorMsg(msg.includes("409") ? "この slug はすでに使用されています" : msg);
      }
    },
  });

  return (
    <Box
      component="form"
      onSubmit={async (e) => {
        e.preventDefault();
        await form.handleSubmit();
      }}
      sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 480 }}
    >
      <Typography variant="subtitle1">新しいコミュニティを作成</Typography>
      {errorMsg && (
        <Alert severity="error" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}
      <form.Field
        name="slug"
        validators={{
          onSubmit: ({ value }) => {
            if (!value) return "slug は必須です";
            if (!COMMUNITY_SLUG_REGEX.test(value))
              return "slug は小文字英数字とハイフンのみ（先頭末尾は英数字）";
            return undefined;
          },
        }}
      >
        {(field) => (
          <TextField
            label="slug（URL 識別子）"
            size="small"
            required
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            inputProps={{ maxLength: COMMUNITY_SLUG_MAX_LENGTH, autoComplete: "off" }}
            error={field.state.meta.errors.length > 0}
            helperText={
              field.state.meta.errors[0] ?? "小文字英数字とハイフンのみ（例: tech-news）"
            }
          />
        )}
      </form.Field>
      <form.Field
        name="name"
        validators={{
          onSubmit: ({ value }) => (!value ? "コミュニティ名は必須です" : undefined),
        }}
      >
        {(field) => (
          <TextField
            label="コミュニティ名"
            size="small"
            required
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            inputProps={{ maxLength: COMMUNITY_NAME_MAX_LENGTH }}
            error={field.state.meta.errors.length > 0}
            helperText={field.state.meta.errors[0] ?? ""}
          />
        )}
      </form.Field>
      <form.Field
        name="description"
        validators={{
          onSubmit: ({ value }) => (!value ? "作風の説明は必須です" : undefined),
        }}
      >
        {(field) => (
          <TextField
            label="作風・説明（定時バッチの生成プロンプトに使用）"
            size="small"
            required
            multiline
            rows={3}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            inputProps={{ maxLength: COMMUNITY_DESCRIPTION_MAX_LENGTH }}
            error={field.state.meta.errors.length > 0}
            helperText={field.state.meta.errors[0] ?? `最大 ${COMMUNITY_DESCRIPTION_MAX_LENGTH} 文字`}
          />
        )}
      </form.Field>
      <Button
        type="submit"
        variant="contained"
        disabled={createMutation.isPending}
        sx={{ alignSelf: "flex-start" }}
      >
        作成
      </Button>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity="success" onClose={() => setSnackbarOpen(false)}>
          コミュニティを作成しました
        </Alert>
      </Snackbar>
    </Box>
  );
}

/** コミュニティ編集フォーム（インライン）。 */
interface EditCommunityFormProps {
  community: Community;
  onCancel: () => void;
}

function EditCommunityForm({ community, onCancel }: EditCommunityFormProps): ReactElement {
  const updateMutation = useUpdateCommunity();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: community.name, description: community.description } as UpdateCommunityInput,
    onSubmit: async ({ value }) => {
      setErrorMsg(null);
      try {
        await updateMutation.mutateAsync({ id: community.id, input: value });
        onCancel();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "更新に失敗しました");
      }
    },
  });

  return (
    <Box
      component="form"
      onSubmit={async (e) => {
        e.preventDefault();
        await form.handleSubmit();
      }}
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      {errorMsg && (
        <Alert severity="error" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}
      {/* アイコン・カバー画像のアップロード（#457）。フォーム送信とは独立した即時アップロード。 */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          カバー画像（ヘッダー）
        </Typography>
        <CommunityImageUpload
          communityId={community.id}
          kind="cover"
          name={community.name}
          currentImageUrl={community.coverUrl ?? null}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
          <CommunityImageUpload
            communityId={community.id}
            kind="icon"
            name={community.name}
            currentImageUrl={community.iconUrl ?? null}
          />
          <Typography variant="caption" color="text.secondary">
            アイコン画像（クリックして変更）
          </Typography>
        </Box>
      </Box>
      <form.Field
        name="name"
        validators={{
          onSubmit: ({ value }) => (!value ? "コミュニティ名は必須です" : undefined),
        }}
      >
        {(field) => (
          <TextField
            label="コミュニティ名"
            size="small"
            required
            value={field.state.value ?? ""}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            inputProps={{ maxLength: COMMUNITY_NAME_MAX_LENGTH }}
            error={field.state.meta.errors.length > 0}
            helperText={field.state.meta.errors[0] ?? ""}
          />
        )}
      </form.Field>
      <form.Field
        name="description"
        validators={{
          onSubmit: ({ value }) => (!value ? "作風の説明は必須です" : undefined),
        }}
      >
        {(field) => (
          <TextField
            label="作風・説明（定時バッチの生成プロンプトに使用）"
            size="small"
            required
            multiline
            rows={3}
            value={field.state.value ?? ""}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            inputProps={{ maxLength: COMMUNITY_DESCRIPTION_MAX_LENGTH }}
            error={field.state.meta.errors.length > 0}
            helperText={field.state.meta.errors[0] ?? `最大 ${COMMUNITY_DESCRIPTION_MAX_LENGTH} 文字`}
          />
        )}
      </form.Field>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button type="submit" variant="contained" size="small" disabled={updateMutation.isPending}>
          保存
        </Button>
        <Button type="button" variant="outlined" size="small" onClick={onCancel}>
          キャンセル
        </Button>
      </Box>
    </Box>
  );
}

/** コミュニティ一覧テーブル行（編集モード切替を持つ）。 */
interface CommunityRowProps {
  community: Community;
}

function CommunityRow({ community }: CommunityRowProps): ReactElement {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TableRow>
        <TableCell colSpan={4}>
          <EditCommunityForm community={community} onCancel={() => setEditing(false)} />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell sx={{ fontFamily: "monospace" }}>{community.slug}</TableCell>
      <TableCell>{community.name}</TableCell>
      <TableCell sx={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {community.description}
      </TableCell>
      <TableCell>
        <Button size="small" variant="outlined" onClick={() => setEditing(true)}>
          編集
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** コミュニティ一覧テーブル本体（#310）。useCommunities は Suspense 化済み（#462）。 */
function CommunityListPanel(): ReactElement {
  const { data: communities } = useCommunities();

  if (communities.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        コミュニティがありません。
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>slug</TableCell>
          <TableCell>名前</TableCell>
          <TableCell>作風・説明</TableCell>
          <TableCell>操作</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {communities.map((community) => (
          <CommunityRow key={community.id} community={community} />
        ))}
      </TableBody>
    </Table>
  );
}

/** コミュニティ一覧のローディングスケルトン（Suspense fallback）。 */
function CommunityListSkeleton(): ReactElement {
  return (
    <Box>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={32}
          data-testid="communities-skeleton-item"
          sx={{ my: 0.5 }}
        />
      ))}
    </Box>
  );
}

/**
 * 管理画面コミュニティタブ（#310）。
 * #462: 一覧（useCommunities）は Suspense 化し、作成フォームは即時表示したいので一覧部分のみ
 * 局所 QueryBoundary（fallback=スケルトン）で包む。
 */
export function CommunitiesTab(): ReactElement {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <CreateCommunityForm />

      <Box>
        <Typography variant="subtitle1" gutterBottom>
          コミュニティ一覧
        </Typography>
        <QueryBoundary fallback={<CommunityListSkeleton />}>
          <CommunityListPanel />
        </QueryBoundary>
      </Box>
    </Box>
  );
}
