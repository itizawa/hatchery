# Issue #485 設計書: ヘッダーの高さをログイン状態に依らず一定にし区切りを薄い borderBottom に統一する

## 背景・目的

グローバルヘッダー `client/src/components/AppHeader.tsx` には 2 つの見た目の問題がある。

1. **ヘッダーの高さがログイン状態で変わる**: 右端要素がログイン時はアバターボタン（実質 40px）、未ログイン時はログインリンク（`py: 0.5`）、ローディング時は 32px の円形 Skeleton で、占有高さがバラつきヘッダー総高が状態によって上下にガタつく。
2. **区切り（影）が強すぎる**: ヘッダーは `boxShadow: 1` で本文と区切るが、サイドバー⇔メインは薄い `borderRight: 1, borderColor: "divider"`。これに揃えたい。

目的は、ヘッダー高さをログイン状態（ログイン / 未ログイン / ローディング）に依らず一定にし、本文との区切りを `boxShadow` から `borderColor: "divider"` の薄い `borderBottom` に変更して、サイドバー⇔メインの区切りと一貫した控えめな見た目にすること。

## 受け入れ条件 → 入出力

| # | 受け入れ条件 | 実装による満たし方 | 検証（テスト） |
|---|---|---|---|
| 1 | ヘッダー高さがログイン/未ログイン/ローディングの 3 状態で同一 | 右端領域（`ml: auto` の Box）に固定高さ `RIGHT_SLOT_HEIGHT`（= アバターボタンの実質高 40px）を与え、`display: flex; alignItems: center; justifyContent: flex-end` で各バリアントを同一高さスロット内に中央寄せ。アバターボタンの `p: 0.5`・ログインリンクの `py`・Skeleton の高さの差がヘッダー総高に波及しなくなる | 3 状態それぞれで右端スロット（`data-testid="header-right-slot"`）が同一の固定 `height` を持つことを検証 |
| 2 | 区切りを `boxShadow: 1` 削除 → `borderBottom: 1, borderColor: "divider"` | header の `sx` から `boxShadow: 1` を除去し `borderBottom: 1, borderColor: "divider"` を追加 | header 要素に `borderBottom` 系スタイルが付与され、`boxShadow` 指定が無いことを検証 |
| 3 | 既存テストが緑のまま、または高さ固定・区切り変更を検証するテストを追加/更新 | 既存テスト（メニュー挙動・ログインリンク表示等）は変更せず緑維持。上記 1/2 を検証する新規テストを追加 | 既存 + 追加テストが緑 |
| 4 | 変更は `client/` のみ。import 境界を崩さない。Zod 変更不要 | `AppHeader.tsx` のみ変更（`RootLayout.tsx` は変更不要）。common への新規依存なし。ユーザー入力文字列フィールドは増えない | lint（import 境界）緑 |
| 5 | build / test / lint すべて緑 | typecheck・lint・client test を緑にする | CI 緑 |

## 設計判断

- **固定高さスロット方式を採用**: 右端の `ml: auto` Box に固定高さ（`RIGHT_SLOT_HEIGHT = 40`px）と `display: flex; alignItems: center` を与え、3 バリアント（アバターボタン / ログインリンク / Skeleton）をその中で縦中央に配置する。これにより、各バリアントの本来の高さ差がヘッダー総高に影響しなくなり、`py: 1` を維持したまま高さが一定になる。
  - 40px の根拠: 現状のログイン状態のアバターボタンが `Avatar`(32px) + `ButtonBase`(`p: 0.5` = 上下 4px ずつ) = 40px で最も背が高い。これを基準スロット高にすることで、ログイン状態の見た目を変えずに他状態を揃えられる。
  - `ACCOUNT_ICON_SIZE`(32) を流用し `RIGHT_SLOT_HEIGHT = ACCOUNT_ICON_SIZE + 8` として定数で表現（ButtonBase の `p: 0.5` 由来の +8 を明示）。
- **区切りの変更**: header の `sx` から `boxShadow: 1` を削除し `borderBottom: 1, borderColor: "divider"` を追加。色は MUI テーマの `divider` トークンを使い、サイドバーの `borderRight` と完全に一致させる。`SLACK_COLORS.sidebar` の背景色は変更しない。
- **テスト方針（TDD）**: jsdom + RTL では実レイアウト計算（getBoundingClientRect の実寸）は行われないため、「3 状態で同一高さ」は **右端スロット要素に同一の固定 `height` スタイルが適用されていること**で担保する。具体的には各状態をレンダリングし、`data-testid="header-right-slot"` 要素の `style.height`（= MUI `sx` の `height: 40` がインライン style に落ちる）が 3 状態で等しいことを assert する。区切りは header 要素の inline style に `border-bottom-*` 系が付き `box-shadow` が無いことで担保する。
- **RootLayout は変更不要**: 揃える先（サイドバーの `borderRight`）は既存のまま参照するだけ。AppHeader 側を合わせる。
- **スコープ外**: 配色・ロゴ・メニュー項目自体は変更しない。高さの一定化と borderBottom 化のみ。

## e2e ユースケースについて

本変更はヘッダーの **見た目（高さの一定化・区切りの border 化）のみ**で、ユーザーから見た機能挙動（メニュー開閉・ログイン導線・遷移）は変わらない。`e2e/auth/usecases.md` がヘッダーのメニュー挙動を既にカバーしており、高さ・border は視覚プロパティで観察可能な機能挙動を変えないため、e2e ユースケースの追加・更新は不要（PR にその旨を記載する）。
