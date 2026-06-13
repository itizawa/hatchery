import type { ReactElement } from "react";

import { WORKER_COMMUNITIES_MAX } from "@hatchery/common";
import type { AdminCommunity } from "../api/communities.js";
import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
} from "./uiParts/index.js";

interface WorkerCommunitiesSelectProps {
  /** 選択肢となる全コミュニティ。 */
  communities: readonly AdminCommunity[];
  /** 現在選択されている communityId 配列。 */
  value: string[];
  /** 選択変更時のコールバック（置換後の id 配列を渡す）。 */
  onChange: (communityIds: string[]) => void;
  /** 選択肢/現在値のロード中は disabled にする。 */
  disabled?: boolean;
  /** label 用 id（複数ダイアログでの衝突回避）。 */
  labelId: string;
}

/**
 * ワーカーの参加コミュニティを複数選択する Select（#490）。
 * `EditWorkerDialog` / `AddWorkerDialog` で共有する。状態は呼び出し元の
 * `@tanstack/react-form`（form.Field）が保持し、本コンポーネントは表示と変更通知のみ担う。
 * 選択上限は common の WORKER_COMMUNITIES_MAX（サーバ Zod と二重防御）。
 */
export function WorkerCommunitiesSelect({
  communities,
  value,
  onChange,
  disabled = false,
  labelId,
}: WorkerCommunitiesSelectProps): ReactElement {
  const nameById = new Map(communities.map((c) => [c.id, c.name]));

  return (
    <FormControl fullWidth size="small" disabled={disabled}>
      <InputLabel id={labelId}>参加コミュニティ</InputLabel>
      <Select
        labelId={labelId}
        label="参加コミュニティ"
        multiple
        value={value}
        inputProps={{ "aria-label": "参加コミュニティ" }}
        onChange={(e) => {
          const next = e.target.value;
          const ids = typeof next === "string" ? next.split(",") : (next as string[]);
          // 上限超過は無視（サーバ Zod とも二重で守る）。
          onChange(ids.slice(0, WORKER_COMMUNITIES_MAX));
        }}
        renderValue={(selected) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {(selected as string[]).map((id) => (
              <Chip key={id} size="small" label={nameById.get(id) ?? id} />
            ))}
          </Box>
        )}
      >
        {communities.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            <Checkbox checked={value.includes(c.id)} size="small" />
            <ListItemText primary={c.name} secondary={c.slug} />
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>
        このワーカーが参加するコミュニティを選択します（最大 {WORKER_COMMUNITIES_MAX} 件）。
      </FormHelperText>
    </FormControl>
  );
}
