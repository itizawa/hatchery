# Issue #596 設計書: SettingsScene タブパネル定型の重複整理

## 背景・目的

`SettingsScene.tsx` の `ApiTokenSettings`/`BatchLogs`/`TokenUsageTab` の 3 タブがいずれも
「`XxxInner` 本体 + 薄いラッパ（`QueryBoundary` + 専用 `Skeleton`）」という三段構造を
手書きで反復している。

このリファクタリングでは、Suspense/QueryBoundary/Skeleton ラップを汎用ヘルパーに集約し、
各タブを Inner 定義のみに簡素化する。

## 受け入れ条件

1. タブパネルの Suspense/QueryBoundary/Skeleton ラップを汎用ヘルパー（`withSettingsTabPanel`）へ集約し、
   各タブは Inner のみを定義する形にする。
2. 既存テストが緑のまま、ユーザー可視挙動は不変。
3. `pnpm turbo run build test lint` が緑。

## 実装方針

### アプローチ: HOC 型 `withSettingsTabPanel` ヘルパー

タブ内 Inner コンポーネントをラップして QueryBoundary + Skeleton を自動付与する
Higher Order Component (HOC) パターンを採用する。

```typescript
// 使用例
const ApiTokenSettings = withSettingsTabPanel(ApiTokenSettingsInner, <ApiTokenSettingsSkeleton />);
const BatchLogs = withSettingsTabPanel(BatchLogsInner, <TabSkeleton testId="batch-logs-skeleton" />);
const TokenUsageTab = withSettingsTabPanel(TokenUsageTabInner, <TabSkeleton testId="token-usage-skeleton" />);
```

### 変更ファイル

- `client/src/routes/SettingsScene.tsx`: `withSettingsTabPanel` ヘルパーを追加し、3 つのラッパコンポーネント定義を削除

### 変更しないもの

- Inner コンポーネントの実装（`ApiTokenSettingsInner`・`BatchLogsInner`・`TokenUsageTabInner`）
- Skeleton コンポーネントの実装（`TabSkeleton`・`ApiTokenSettingsSkeleton`）
- テストファイル（既存テストがそのまま緑になることを確認する）
- ユーザー可視の挙動

## テスト方針

本 Issue は純粋なリファクタリング（ユーザー可視挙動の変更なし）のため、
既存の `SettingsScene.test.tsx` が変更なしで緑になることで受け入れ条件を満たす。

TDD の観点から:
1. 既存テストを実行して現状緑であることを確認
2. `withSettingsTabPanel` ヘルパーのユニットテストを追加（HOC が children を QueryBoundary で包むこと）
3. ヘルパーを実装してすべてのテストが緑になることを確認
