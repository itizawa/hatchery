# 設計書: post カード内の vote ボタン押下でページ遷移してしまうのを防ぐ（preventDefault 不足） (#411)

## 1. 目的 / 背景

`CommunityScene` と `HomeFeedScene` は post カード全体を TanStack Router の `RouterLink`（`<a href="...">`）で包んでいる。
カード内の vote ボタン押下時は `PostCard` の `voteStopPropagation` prop によって `e.stopPropagation()` を呼ぶが、`e.preventDefault()` を呼んでいない。

TanStack Router の `Link` は自身の `onClick` で `e.preventDefault()` を呼んでから SPA 遷移するため、`stopPropagation()` だけでは `<a>` の `onClick`（= TanStack Router のハンドラ）が呼ばれなくなり、ブラウザのデフォルト動作（`href` へのネイティブ遷移）が抑止されない。
結果として vote ボタン押下時にフルページ遷移が発生し、vote の API コール・楽観更新が中断される。

## 2. スコープ（やること / やらないこと）

**やること:**
- `PostCard.tsx` の `voteStopPropagation` ハンドラに `e.preventDefault()` を追加（1 行の修正）
- `PostCard.test.tsx` に `preventDefault` + `stopPropagation` 両方の呼び出しを検証するテストを追加

**やらないこと:**
- カード構造の変更（RouterLink ラップを維持、タイトルのみリンク化等の構造変更はしない）
- `ShareButton` の同種問題（スコープ外、別 Issue）
- `CommunityScene` / `HomeFeedScene` の変更（PostCard 側の修正だけで両画面が直る）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `voteStopPropagation=true` 時の vote ボタンクリックで `stopPropagation` が呼ばれる
2. `voteStopPropagation=true` 時の vote ボタンクリックで `preventDefault` が呼ばれる
3. up vote・down vote ともに条件 1・2 を満たす
4. `onVote` が正しい direction で呼ばれること（既存テスト継続緑）
5. `pnpm turbo run build test lint` が緑

## 4. 設計方針

`PostCard.tsx:47` のハンドラを以下のように変更するだけ:

**変更前:**
```tsx
onClick={voteStopPropagation ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
```

**変更後:**
```tsx
onClick={voteStopPropagation ? (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); } : undefined}
```

`stopPropagation()` はReact SyntheticEventの伝播を止め（TanStack Router の onClick が発火しない）、
`preventDefault()` はブラウザのデフォルト動作（ネイティブ `<a>` 遷移）を抑止する。

## 5. 影響範囲 / 既存への変更

- **対象ワークスペース**: `client/` のみ
- **変更ファイル**: `client/src/components/PostCard.tsx`（1 行修正）、`client/src/components/PostCard.test.tsx`（テスト追加）
- `CommunityScene.tsx`・`HomeFeedScene.tsx` の変更は不要（PostCard 修正で両画面が自動的に修正される）

## 6. テスト計画（TDDで書くテスト一覧）

`PostCard.test.tsx` に追加:
1. `voteStopPropagation` 有効時、up vote クリックで `stopPropagation` と `preventDefault` の両方が呼ばれる
2. `voteStopPropagation` 有効時、down vote クリックで `stopPropagation` と `preventDefault` の両方が呼ばれる
3. `voteStopPropagation` 有効時でも `onVote` が正しい direction で呼ばれる（回帰確認）

テスト手法: `fireEvent` でネイティブ MouseEvent を dispatch し、`vi.spyOn(event, "stopPropagation")` / `vi.spyOn(event, "preventDefault")` でスパイする（React SyntheticEvent は内部でネイティブイベントの各メソッドに委譲する）。

## 7. リスク・未決事項

- jsdom 環境での `stopPropagation` / `preventDefault` スパイが React SyntheticEvent 経由で正しくキャプチャされるか、TDD で先に確認する。
