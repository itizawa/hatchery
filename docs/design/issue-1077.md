# 設計書: ポスト詳細（PostThread）ローディング中に左カラムが潰れて表示される幅バグを修正する (#1077)

## 1. 目的 / 背景

`/posts/$postId` のローディング中、左カラム（`PostThreadSkeleton` の post 本文相当）が右カラム（`CommunitySidebarCard` 相当・幅312px固定）より大幅に狭く潰れて表示される。

`PostThreadScene.tsx` と `PostThreadSkeleton.tsx` の外枠 `sx`（`p: 3, maxWidth: 1200, mx: "auto"`）は #955 で統一済みで完全一致しているが、原因は sx の不一致ではなく CSS Flexbox の仕様: `RootLayout.tsx` の `main`（`display:"flex", flexDirection:"column"`）の直下では、cross 軸（= 幅）の auto margin（`mx:"auto"`）を持つ flex item は **`align-items`/`align-self` の `stretch` 効果を受けない**（CSS Flexbox 仕様 8.2 "Aligning with auto margins": auto margin が優先され stretch は適用されない）。そのため `width` が指定されていない（`auto` のままの）今回の外枠 Box は、cross 軸で stretch されず shrink-to-fit サイズ（内容物に基づく最小限のサイズ）になる。

実データ表示時は実テキストの max-content 幅で偶然広く見えるが、ローディング時は `Skeleton width="70%"` 等パーセント幅の子要素に実質的な基準幅がなく、左カラムが最小幅まで潰れる。

**実装時の検証と方針転換**: 初期実装では `alignSelf: "stretch"` を追加したが、これは前段落のとおり `mx:"auto"`（cross 軸の auto margin）がある限り無効（no-op）であることを、セルフレビュー時に実 Chromium（Playwright）で最小再現 HTML を用いて実測し確認した（`main`幅2000px・`maxWidth:1200px + mx:auto` のみ→実測幅 0px、`alignSelf:"stretch"` 追加後も実測幅 0px = 効果なし、`width:"100%"` 追加後は実測幅 1200px・左右マージン400pxで正しく中央寄せ）。したがって正しい修正は **`width: "100%"` を追加する**こと。`width:"100%"` により cross 軸に明示的な（`auto` でない）サイズが与えられ、`maxWidth:1200` 適用後の残り幅を `mx:"auto"` が正しく中央寄せできるようになる（Bootstrap の `.container` 等でも使われる `width:100% + max-width + margin:auto` の中央寄せパターンと同じ機序）。

## 2. スコープ（やること / やらないこと）

- やること: `PostThreadScene.tsx` の外枠 Box と `PostThreadSkeleton.tsx` の外枠 Box に `width: "100%"` を追加し、column flex 親内でも shrink-to-fit にならないようにする。両者に対称的な `data-testid` を付与し、RTL から実際に適用された computed style を検証できるようにする。
- やらないこと: 同じ `maxWidth` + `mx:"auto"` パターンを使う他の画面（`SearchScene` / `CommunityScene` / `CommunityBrowseScene` / `HomeFeedScene` / `WorkerScene` / `WorkerRankingScene` 等）の横断的な確認・修正（Issue 本文にも明記のとおりスコープ外・別 Issue。これらの画面も理論上は同じ潜在バグを抱えている可能性が高いが、横断対応は別 Issue とする）。
- `client/` ワークスペースのみで完結する。server / common への変更は無し。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `PostThreadScene.tsx:241` と `PostThreadSkeleton.tsx:19-23` の外枠 Box に、column flex 親内でも shrink-to-fit にならない指定（`width: "100%"`）を追加する。
2. RTL テストで、実際に適用された computed style（`getComputedStyle` — 後述「7. リスク・未決事項」参照）を用いて、`PostThreadScene` の外枠 Box と `PostThreadSkeleton` の外枠 Box の `width` が両方とも `"100%"` であることを検証する新規テストを追加する。sx プロパティのオブジェクト一致のみの検証（#955 時点で既に一致しているにもかかわらずバグが再発した経緯があるため）ではこのバグを再度検出できないため、実際に DOM に適用された CSS 値を検証する。
3. 既存の `PostThreadSkeleton.test.tsx` のアサーション（testid・sx 一致）を壊さない。
4. `client/` ワークスペースのみで完結させる。
5. ローディング表示のみの視覚調整で表示項目・操作結果は変わらないため `e2e/` の更新は不要（PR 本文にその旨を明記する）。
6. `pnpm turbo run build test lint` が緑（本 Issue は `client` に閉じるため `pnpm --filter @hatchery/client run build test lint` で代替確認する）。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- `client/src/routes/PostThreadScene.tsx`: 外枠 `Box component="section"` (line 241) に `width: "100%"` を追加し、`data-testid="post-thread-scene"` を付与する（`PostThreadSkeleton` の `data-testid="post-thread-skeleton"` と対称的な命名）。
- `client/src/components/PostThreadSkeleton.tsx`: 外枠 `Box component="section"` (line 19-23) の `sx` に `width: "100%"` を追加する（`data-testid="post-thread-skeleton"` は既存のまま流用）。
- 変更は sx プロパティの追加のみで、DOM 構造・props・既存 data-testid は変更しない（既存テストへの影響を最小化）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / server / common / docs）

- 対象ワークスペース: `client` のみ。
- 影響ファイル: `client/src/routes/PostThreadScene.tsx`、`client/src/components/PostThreadSkeleton.tsx`、`client/src/routes/PostThreadScene.test.tsx`（新規テスト追加）。
- server / common / docs（本設計書除く）への変更なし。

## 6. テスト計画（TDDで書くテスト一覧）

- `PostThreadScene.test.tsx` に新規 `describe` ブロックを追加:
  - `PostThreadScene`（`createWrapper` でシード済みデータを使い即時描画）の外枠 `post-thread-scene` の `getComputedStyle(...).width` が `"100%"` であることを検証。
  - `PostThreadSkeleton`（単体描画）の外枠 `post-thread-skeleton` の `getComputedStyle(...).width` が `"100%"` であることを検証。
- 既存の `PostThreadSkeleton.test.tsx`・`PostThreadScene.test.tsx` の他のテストは変更しない（回帰確認）。

## 7. リスク・未決事項

- **jsdom の layout 計算の制約**: Vitest の test 環境は `jsdom`（`client/vitest.config.ts` の `test.environment: "jsdom"`）であり、実ブラウザと異なり実際のボックスジオメトリ計算（layout/reflow）を行わないため、`getBoundingClientRect()` は常にゼロ相当の値を返し、実測ピクセル幅の比較には使えない。本リポジトリの既存テスト（`PostCard.test.tsx` / `AppHeader.test.tsx` / `uiParts/Menu.test.tsx`）でも同様の制約下で `getComputedStyle(...)` により実際に適用された CSS 宣言値を検証する手法を採用しており、本 Issue のテストもこれに倣う。
  - **重要な注意**: jsdom は CSS Flexbox の実レイアウト解決（auto margin と stretch の優先順位など）を行わないため、`getComputedStyle(...).width` は「指定した CSS 宣言値」を返すだけで、実際に auto margin との相互作用で正しく中央寄せ・stretch されるかどうかまでは検証できない。そのため本 Issue のセルフレビューでは、実 Chromium（Playwright, `/opt/pw-browsers/chromium`）で最小再現 HTML を作り実測することで、`width:"100%"` が実際に意図通りの幅（1200px・左右中央寄せ）を生むこと、および当初実装していた `alignSelf:"stretch"` 単体では効果がない（実測 0px のまま）ことを確認した。今後同種の flex レイアウト修正を行う際は、jsdom テストだけでなく実ブラウザでの目視確認または最小再現による実測を必須とする。
- 同一パターンを使う他画面の横断確認は本 Issue のスコープ外（Issue 本文に明記）。
