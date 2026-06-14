# 設計書: Issue #502 投稿・コメントカードに投稿時刻（相対時間）を表示する

## 背景・目的

投稿カード（`PostCard`）・コメントカード（`CommentCard`）に投稿時刻の表示が無い。Hatchery は一日数回の「定時」にまとめて投稿が生まれる定時方式であり、各投稿・コメントがいつのものか分かることで「定時で動いている」体験と新着の手触りが伝わる。Reddit 風 UI に倣い、各投稿に「3時間前」等の相対時刻を表示する。API は post / comment とも `created_at` を返しており、UI 側で出すだけでよい。

## 受け入れ条件 → 入出力

### AC1 / AC2: 相対時間整形（純粋関数 + ユニットテスト）

DOM / React 非依存のため `common/src/logic/formatRelativeTime.ts` に純粋関数 `formatRelativeTime(target, now)` を置く（ADR-0005）。基準時刻 `now` を引数で受け取り `Date.now()` をロジック内に埋め込まない（テスト可能性のため）。

整形方針（日本語表記）:

| 経過時間 `now - target` | 出力 |
|---|---|
| 負（未来） / 60秒未満 | `たった今` |
| 60秒以上 60分未満 | `N分前` |
| 60分以上 24時間未満 | `N時間前` |
| 24時間以上 7日未満 | `N日前` |
| 7日以上 | `YYYY/M/D`（年月日。年をまたぐ古い投稿でも一意に分かる絶対日付） |

- 入力: `target: Date`（投稿時刻）, `now: Date`（基準時刻）。
- 出力: `string`。
- 端数は切り捨て（`Math.floor`）。例: 119分前 → `1時間前`。
- 不正な `Date`（`NaN`）は空文字を返し描画を破綻させない。

### AC3: PostCard / CommentCard の RTL テストに時刻表示ケースを追加

- `PostCard` / `CommentCard` は `created_at` を相対時間で表示する。
- 表示は `<time dateTime={ISO}>` 要素を使い、機械可読な絶対時刻を `dateTime` 属性に持たせる（アクセシビリティ・将来のツールチップ拡張に備える）。
- client では `formatRelativeTime(new Date(created_at), new Date())` を呼ぶ（`now` は描画時の現在時刻）。テストでは `vi.setSystemTime` で現在時刻を固定して相対表記を検証する。
- `created_at` が未指定（後方互換）の場合は時刻を描画しない（破綻しない）。

### AC4: build / test / lint 緑・import 境界

- `formatRelativeTime` は `common` に置き `common/src/index.ts` から export。client から `@hatchery/common` 経由で import（client → common の一方向のみ）。
- `created_at` は内部生成値のため `.max()` 対象外。

## 設計判断

- **配置**: 相対時間整形は DOM 非依存の純粋関数のため `common`（既存 `calcPostedAtOffsets` 等と同じ `common/src/logic/`）に置く。client 限定にしないことで server / Storybook からも再利用可能。
- **`now` の注入**: `Date.now()` 直叩きを避け引数注入。コンポーネント側で現在時刻を生成して渡す。
- **`<time>` 要素**: セマンティックに正しく、`dateTime` に ISO 文字列を持たせることで将来の絶対時刻ツールチップ（スコープ外）拡張が容易。
- **uiParts 縛り（#178）**: `<time>` は素の HTML 要素であり MUI コンポーネントではないため uiParts 経由は不要。テキストは `Typography component="time"` で表現する。

## スコープ外

- タイムゾーン選択 UI・絶対時刻ツールチップ（将来拡張）。
