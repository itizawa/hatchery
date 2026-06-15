# Issue #531 設計書: WorkerCommunitiesSelect.tsx の RTL テストを追加する

## 背景・目的

`client/src/components/WorkerCommunitiesSelect.tsx`（ワーカーの参加コミュニティ複数選択 Select・#490）は
`EditWorkerDialog` / `AddWorkerDialog` で共有される選択ロジック付きコンポーネントだが、
sibling の `*.test.tsx` が無い唯一の実体コンポーネントだった。
選択トグル・上限 `WORKER_COMMUNITIES_MAX`・`disabled`・チップ表示の分岐を RTL でカバーし、
フォーム連携の回帰を防ぐ。

これはテスト追加のみ（プロダクションコードの振る舞い変更なし）。

## 対象コンポーネントの仕様（既存実装の確認）

`WorkerCommunitiesSelect`（presentational・状態は呼び出し元の useForm が保持）:

- props: `communities`（選択肢）/ `value`（選択中 id 配列）/ `onChange`（置換後 id 配列を返す）/
  `disabled?` / `labelId`。
- MUI `Select multiple`。`onChange` は受け取った id 配列を
  `ids.slice(0, WORKER_COMMUNITIES_MAX)` してから親 `onChange` に渡す（上限の二重防御）。
- `renderValue` で選択中 id を `Chip`（`name` 表示・name 無ければ id）で表示。
- 各 `MenuItem` は `Checkbox checked={value.includes(id)}` + `ListItemText`（name / slug）。
- `disabled` 時は `FormControl disabled` で操作不可。

## 受け入れ条件 → テスト対応

`client/src/components/WorkerCommunitiesSelect.test.tsx` を新設し、以下を検証する。

| # | 受け入れ条件 | テスト |
|---|-------------|--------|
| (a) | `communities` が選択肢として描画される | Select を開き各 option が表示される |
| (b) | 未選択→選択で `onChange` に選択後の id 配列が渡る | 未選択状態で option をクリック → `onChange([id])` |
| (c) | 既選択を解除すると配列から除かれる | 選択済み状態で同 option クリック → `onChange([])` |
| (d) | `WORKER_COMMUNITIES_MAX` 到達後は上限が効く | MAX 件選択済み + 余分 1 件で余分を選択 → `onChange` が MAX 件に丸められる（余分が落ちる） |
| (e) | `disabled` 時は操作不可 | `disabled` で combobox が無効・menu が開かない・`onChange` が呼ばれない |
| (f) | 現在値がチップ等で表示される | `value` の id に対応する name が Chip として表示される |

## 設計判断

- **制御コンポーネント前提のためテストハーネスで `onChange` を spy**。`value` は props 直渡しで固定し、
  `onChange` のコール引数を assert する（実コンポーネントは内部 state を持たない）。
- **MUI Select の操作は既存 `EditWorkerDialog.test.tsx` の作法に倣う**:
  `fireEvent.mouseDown(combobox)` で開き、`getByRole("option")` をクリック、
  `fireEvent.keyDown(listbox, { key: "Escape" })` で閉じる。
- **上限 (d) は `WORKER_COMMUNITIES_MAX`（=100）件を value に詰めた状態 + 余分 1 件**で検証する。
  余分 option をクリックすると Select の onChange は MAX+1 件を返すが、コンポーネントが
  `slice(0, MAX)` で丸めるため親 `onChange` には MAX 件だけ渡り、余分 id は含まれない。
  これにより上限ロジックを定数依存で（マジックナンバー無しで）検証する。
- **client → common の一方向 import を守る**: `WORKER_COMMUNITIES_MAX` は `@hatchery/common` から import。
- `AdminCommunity` 型は最小フィールド（id / slug / name + 必須の description / created_at）で
  テストデータを組む。

## スコープ外

- `EditWorkerDialog` / `AddWorkerDialog` 自体（別途テスト済み）。
- プロダクションコードの変更（テスト追加のみ）。
- e2e usecases 更新（ユーザー可視の振る舞い変更なし＝純粋なテスト追加のため不要）。
