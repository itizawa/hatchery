import type { ReactElement } from "react";

import { useCommunities } from "../api/communities.js";
import { QueryBoundary } from "./QueryBoundary.js";
import { WorkerCommunitiesSelect } from "./WorkerCommunitiesSelect.js";
import { Alert, FormControl, InputLabel, Select } from "./uiParts/index.js";

interface WorkerCommunitiesFieldProps {
  /** 現在選択されている communityId 配列。 */
  value: string[];
  /** 選択変更時のコールバック（置換後の id 配列を渡す）。 */
  onChange: (communityIds: string[]) => void;
  /** label 用 id（複数ダイアログでの衝突回避）。 */
  labelId: string;
}

/**
 * コミュニティ一覧（useCommunities）を取得して WorkerCommunitiesSelect を描画する内部コンポーネント。
 * #462: useCommunities は Suspense 化したため、本コンポーネントを QueryBoundary で包む
 * （ローディング=無効化された Select、取得失敗=注意アラート）。
 */
const WorkerCommunitiesFieldInner = ({
  value,
  onChange,
  labelId,
}: WorkerCommunitiesFieldProps): ReactElement => {
  const { data: communities } = useCommunities();
  return (
    <WorkerCommunitiesSelect
      labelId={labelId}
      communities={communities}
      value={value}
      onChange={onChange}
    />
  );
};

/** コミュニティ取得中の Select プレースホルダ（無効化された空 Select）。 */
const WorkerCommunitiesFieldFallback = ({ labelId }: { labelId: string }): ReactElement => (
  <FormControl fullWidth size="small" disabled>
    <InputLabel id={labelId}>参加コミュニティ</InputLabel>
    <Select labelId={labelId} label="参加コミュニティ" multiple value={[]} />
  </FormControl>
);

/**
 * ワーカーの参加コミュニティ選択フィールド（#490 / #462）。
 * コミュニティ一覧取得（useCommunities・Suspense）を局所 QueryBoundary に閉じ込め、
 * 取得中は無効化 Select、取得失敗は注意アラートを表示する。状態は呼び出し元の form.Field が保持する。
 */
export const WorkerCommunitiesField = ({
  value,
  onChange,
  labelId,
}: WorkerCommunitiesFieldProps): ReactElement => (
  <QueryBoundary
    fallback={<WorkerCommunitiesFieldFallback labelId={labelId} />}
    errorFallback={() => (
      <Alert severity="warning">
        参加コミュニティの読み込みに失敗しました。コミュニティの選択はできません。
      </Alert>
    )}
  >
    <WorkerCommunitiesFieldInner value={value} onChange={onChange} labelId={labelId} />
  </QueryBoundary>
);
