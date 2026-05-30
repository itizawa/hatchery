# 設計書: common/src/domain 配下のファイルの整理 (#24)

## 1. 目的 / 背景

`common/src/domain` 配下はドメインごとに 1 ファイル（`channel.ts` / `employee.ts` 等）でフラットに置かれている。今後ドメインごとに型・スキーマ・純粋ロジック・テストが増えていくにあたり、**ドメイン単位のフォルダ**へ整理しておくことで凝集度を高め、追加先を明確にする。

Issue 本文の指示:

> `common/src/domain` はそれぞれのフォルダに分けてください。
> 例えば `common/src/domain/channel.ts` → `common/src/domain/channel/channel.ts` `common/src/domain/channel/index.ts` としてください

## 2. スコープ（やること / やらないこと）

### やること

- `common/src/domain/*.ts`（`auth` / `channel` / `employee` / `message` / `task`）を、それぞれ同名フォルダ配下へ移動する。
  - `domain/<name>.ts` → `domain/<name>/<name>.ts`
  - `domain/<name>.test.ts` → `domain/<name>/<name>.test.ts`
  - `domain/<name>/index.ts` を新設し、`<name>.ts` を re-export する公開窓口にする。
- 移動に伴う import パスの追従修正（`common/src/index.ts` と `common/src/logic/*` の domain 参照）。

### やらないこと

- ドメインモデル・スキーマ・ロジックの**振る舞いの変更**（純粋なファイル移動と re-export のみ。中身は不変）。
- `common/src/logic/` の同様の整理（本 Issue の指示対象は `domain` 配下のみ）。
- 公開 API（`@hatchery/common` から export されるシンボル）の増減。

## 3. 受け入れ条件（テストに落とせる粒度）

- [ ] 各ドメインが `domain/<name>/` フォルダ配下に `<name>.ts` + `index.ts` の構成で存在する（`auth` / `channel` / `employee` / `message` / `task`）。
- [ ] `domain/<name>/index.ts` 経由で当該ドメインの公開シンボル（例: `ChannelSchema` / `DEFAULT_CHANNELS` / `CHANNEL_IDS`）を import できる。
- [ ] パッケージ公開窓口 `@hatchery/common`（`src/index.ts`）から export されるシンボルが**従来と完全に一致**する（`index.test.ts` が緑）。
- [ ] 既存の全テスト（37 件）が緑のまま（振る舞い不変）。
- [ ] `eslint .`（import 境界・整形）が通過する。

## 4. 設計方針

- 各ドメインフォルダの **`index.ts` を唯一の公開窓口**とし、フォルダ外（`src/index.ts` や `logic/`）からは `domain/<name>/index.js` を参照する。実体ファイル（`<name>.ts`）への直接参照はフォルダ内テストに限定する。
- モジュール解決は `nodenext`（`tsconfig.base.json`）。ディレクトリの暗黙 index 解決は無いため、フォルダ参照は**明示的に `/index.js`** を付ける。
- フォルダ内のテスト（`<name>.test.ts`）は同階層の `./<name>.js` を参照するため、移動後も相対パスは不変（修正不要）。

### 影響を受ける import の追従

| ファイル                                           | 変更前                  | 変更後                        |
| -------------------------------------------------- | ----------------------- | ----------------------------- |
| `src/index.ts`                                     | `./domain/<name>.js`    | `./domain/<name>/index.js`    |
| `src/logic/formatRecentLog.ts` / `.test.ts`        | `../domain/message.js`  | `../domain/message/index.js`  |
| `src/logic/selectAppearingMembers.ts` / `.test.ts` | `../domain/employee.js` | `../domain/employee/index.js` |

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **common のみ**（client / server / docs への影響なし＝公開 API 不変のため）。
- ドメイン間の相互 import は存在しない（各 `<name>.ts` は `zod` のみ依存）ため、移動による連鎖修正は `src/index.ts` と `logic/` の参照のみ。

## 6. テスト計画（TDD で書くテスト）

- 新規 `src/domain/index.test.ts`: 各ドメインの**フォルダ index 経由**（`./<name>/index.js`）で代表シンボルが import・利用できることを検証する。
  - 移動前はフォルダ index が存在しないため**モジュール解決エラーで失敗**（red）。
  - 移動 + index 新設後に**緑**（green）。
- 既存テスト（`index.test.ts` ほか 37 件）はリグレッションガードとしてそのまま緑を維持する。

## 7. リスク・未決事項

- リスクは低い（純粋なファイル移動 + re-export）。最大の注意点は nodenext のディレクトリ index 非解決で、`/index.js` 明示で対処済み。
- 検証環境の Node について: 本リポジトリは Node >=26 を要求（`.nvmrc=26` / `engines`）。本変更は Node バージョン非依存（モジュール構成の整理のみ）であり、ローカル検証は Node 26.2.0 で実施した。
