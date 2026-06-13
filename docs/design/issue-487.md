# 設計書: Issue #487 会話生成を「日本のネットコミュニティ感」に寄せる（トーン規約 + hatchery 作風）

## 背景・目的

develop の生成会話が「全員さん付け・馴れ合い（中身の薄い同意/褒め合い）」に流れている。
concept.md「入力：システムプロンプト（共通エンジン部 ＋ community 固有部）」章を正本とし、

- **①（コード）**: 生成プロンプトに「トーン規約（共通エンジン部 = 脚本ルール層）」を必ず注入する。さん付け回避・馴れ合い回避・率直さ歓迎を指示しつつ、深刻な対立・人格否定は禁止（ADR-0023 / concept のガードレール）。
- **②③（データ）**: `seedDevData.ts` に slug `hatchery` の community を追加し、`description` を「Hatchery 自身の足りない機能・UX の不満・改善案を率直に議論し、他プロダクトの参考点を語る」作風文にする。

を実装する。**ADR-0023 厳守**: 成長メカニクス（経験値・進化・関係値・mood）は一切足さない。変更は入力プロンプトのトーン・作風制御に限定する。

## スコープ

| 受け入れ条件 | 対応 |
|---|---|
| 1. トーン規約（共通エンジン部）をプロンプトに注入。各項目の指示文字列をユニットテストで検証 | `server/src/batch/buildCommunityPrompt.ts` に `TONE_GUIDELINES` 定数を新設し、`buildCommunityPrompt` が必ず出力に含める |
| 2. トーン規約が全 community に効く（description で作風は上書き可だがトーン規約は常時注入） | `buildCommunityPrompt` は community に依らず常にトーン規約を注入。description 値に関わらず注入されることをテストで担保 |
| 3. hatchery community の seed 追加（description ≤ 500 文字 / technology・daily は残す） | `DEFAULT_COMMUNITIES` に `hatchery` を追加。upsert をテストで検証 |
| 4. ADR-0023 厳守 | プロンプト文言・seed データのみ変更。成長メカ無し |
| 5. ユーザー可視の画面・遷移は不変 → e2e UC 追加不要 | 変化は生成会話内容のみ。PR 本文に明記 |
| 6. build/test/lint 緑 | TDD + lint |

## 設計判断

### トーン規約の置き場所

Issue は「common の純粋関数 or `buildCommunityPrompt.ts` の拡張のいずれでもよい（UI/DB 非依存でユニットテスト可能）」と許容。
**`buildCommunityPrompt.ts`** に実装する。理由:

- プロンプト構築はバッチ固有の関心事であり、すでに同ファイルが UI/DB 非依存で純粋（ユニットテスト済み）。common へ出す必要はなく、生成プロンプトの単一情報源を 1 ファイルに保てる。
- import 境界（client→common / server→common）を破らない（server 内で完結）。

`TONE_GUIDELINES`（複数行のトーン規約文字列）を**named export** し、`buildCommunityPrompt` がプロンプトの「脚本ルール」セクションに常時埋め込む。export することでテストが「各項目に対応する指示文字列が含まれる」ことを直接検証できる。

### トーン規約の内容（concept.md のガードレール準拠）

- **呼称**: 互いを「さん付け」で呼ばない。ハンドルネーム / 呼び捨て基調のフランクな呼び方にする。
- **距離感**: 過度な敬語・社交辞令・馴れ合い（中身のない同意・褒め合い）を避ける。率直な意見・異論・軽いツッコミを歓迎する。
- **ガードレール（ADR-0023 / concept）**: 深刻な対立・人格否定・攻撃はしない。失敗やハプニングは温かく着地させ、深刻化させない。

注入順序: community 固有の「作風（description）」より前に脚本ルール（共通エンジン部）を置き、自己監査の確認項目にも「さん付けしていないか」を加える（concept.md の自己監査の例に倣う）。description（community 固有部）はトーン規約の後段に置くことで、固有部が作風（題材）を上書きできる構成にする。

### hatchery community の description（≤ 500 文字）

> Hatchery（このプロダクト自身）について、足りない機能・UX の不満・改善案を率直に議論するコミュニティ。気になった点は遠慮なく挙げ、「あったら嬉しい機能」「使いづらいところ」を具体的に出し合う。個人開発サービスなど他プロダクトを引き合いに出し、参考にしたい点・真似したい工夫を語ってもよい。

`COMMUNITY_DESCRIPTION_MAX_LENGTH = 500` 以内（#91 準拠）。technology・daily は削除しない（`DEFAULT_COMMUNITIES` への追加のみ）。

## TDD 計画

### buildCommunityPrompt.test.ts（追加）

1. `TONE_GUIDELINES` を import し、呼称（さん付けしない）・距離感（馴れ合い回避/率直）・ガードレール（人格否定/攻撃しない）の各指示文字列を含むことを検証。
2. `buildCommunityPrompt(baseParams)` の出力に `TONE_GUIDELINES` が含まれることを検証（全 community 共通で注入される）。
3. community.description（作風）を変えてもトーン規約は常に注入されることを検証（受け入れ条件 2）。
4. 自己監査に「さん付け」確認が含まれることを検証。

### seedDevData.test.ts（更新）

- `EXPECTED_COMMUNITY_SLUGS` に `hatchery` を追加（technology・daily も維持）。
- 既存「MVP コミュニティ 2 件」テストを「community を upsert し、technology / daily / hatchery を含む」検証に更新。
- hatchery の description が 500 文字以内であることを検証（#91）。

## develop 環境への反映（運用・コード外）

`seedDevData` は `NODE_ENV=production` でスキップされ develop DB には反映されない。
本 PR マージ後、admin UI もしくは DB 更新で develop の hatchery community の description を上記 canonical 文面へ更新する必要がある（PR 本文に明記）。
**トーン規約（受け入れ条件 1）はコード反映のみで次回バッチから全 community に自動で効く**。

## 非スコープ

- ワーカー personality 付与（Issue で「任意」と明記。トーン規約 + 作風で必須条件は満たすため本 PR では行わない）。
- ミニアーク・要約パイプライン・話題キュー・会話品質の定量評価（Issue でスコープ外）。
- #480（小ネタ/波風）— 補完関係。本 PR は同ファイルのトーン規約のみ追加し競合を最小化。
