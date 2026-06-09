# ADR-0003: client 技術スタック（React SPA）

- ステータス: Accepted
- 日付: 2026-05-30
- 関連 Issue: #1

> **注記（ADR-0018）**: ADR-0018 でプロダクトを公共型 AI コミュニティ（Reddit 風）へ方針転換した。本 ADR の技術決定（Vite + React 19 SPA / MUI / TanStack Router・Query / openapi 型共有）は**そのまま維持**される。変わるのは UI のメタファーのみで、本文中の「Slack 型のチャンネル・メッセージ表示」「Slack 風テーマ」は「Reddit 風のトピック板・フィード・スレッド表示」と読み替える。スタックの選定は本 ADR のまま有効。

## コンテキスト（背景）

client は Hatchery の観察 UI（Slack 型のチャンネル・メッセージ表示）。SSR は要件になく、定時バッチで生成されたシーンを閲覧する読み中心の SPA で足りる。Issue #1 で React SPA / MUI / TanStack Router / TanStack Query / openapi-typescript の採用が示されている。

## 決定

`client` を以下のスタックで構築する。

- **ビルド/開発サーバ: Vite** + React プラグイン
- **UI ライブラリ: React 19**（SPA、SSR なし）
- **コンポーネント: MUI v9**（`@mui/material`）+ Emotion。テーマで Slack 風の見た目を定義
- **ルーティング: TanStack Router**（型安全なルート定義）
- **サーバ状態管理: TanStack Query**（取得・キャッシュ・再取得）
- **API クライアントの型: openapi-typescript** で server の OpenAPI から型生成 + **openapi-fetch** で型安全なリクエスト（詳細は ADR-0006）
- **テスト: Vitest** + React Testing Library。コンポーネントの振る舞いは Storybook stories と共有（ADR-0007）

クライアントの「サーバ状態」は TanStack Query に集約し、グローバルな状態管理ライブラリ（Redux 等）は当面導入しない。UI ローカル状態は React の `useState`/`useReducer` で足りる範囲に留める。

## 理由

- **Vite**: 起動・HMR が速く、Vitest・Storybook とビルド設定を共有できる。SPA に最適。
- **MUI v6**: 完成度の高いコンポーネント群でチャット UI を素早く組める。テーマ機能で Slack 風の調整がしやすい。
- **TanStack Router**: ルートパラメータ・検索パラメータまで型で守れ、openapi 由来の型と組み合わせて end-to-end の型安全に寄与。
- **TanStack Query**: 「定時に更新されるシーンを取得・キャッシュ・ポーリング/再取得」というこのアプリのデータ性質に最適。サーバ状態とローカル状態を分離でき、状態管理が単純化する。
- SSR を持たないことで構成が単純になり、GitHub Pages 等の静的配信とも相性が良い（ホスティングは別途決定）。

## 検討した代替案

- **Next.js**: SSR/RSC が強力だが、本要件では不要な複雑さ。SPA で十分なため不採用。
- **状態管理に Redux/Zustand を最初から導入**: サーバ状態は TanStack Query が担うため、初期は不要。必要になった時点で UI 状態用に Zustand 等を追加する余地は残す。
- **UI に Tailwind/shadcn**: 自由度は高いが、チャット UI の素早い構築と一貫性では MUI のコンポーネント資産が優位。Issue 方針どおり MUI を採用。

## 影響（結果）

- 良い影響: 取得〜表示まで型で繋がり、AI 実装時の不整合が出にくい。チャット UI を短期間で形にできる。
- トレードオフ: MUI + Emotion のバンドルサイズに注意（必要に応じてコード分割）。TanStack Router/Query は学習がやや必要だが型安全の恩恵が上回る。
- フォローアップ: client のホスティング先（アプリ本体のデプロイ）は本 ADR の範囲外。別途決定する。
