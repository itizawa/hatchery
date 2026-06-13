---
description: develop → main 昇格前に人間が 1 回実行するリリース判定 e2e。Workflow 機能で e2e エリアごとに並行サブエージェントを立て、develop 環境を実際に触って (1) ユースケースの動作確認と (2) 画面デザインが崩れていないかの視覚確認を行う。NG が見つかったら priority/high + 直近マイルストーンで Issue を起票し、最後に GO / NO-GO を判定する。実装はしない（検証と起票のみ）。
argument-hint: "[任意: 検証エリアを絞る（例: home-feed, community, post-thread, auth, admin）。空なら全エリアを並行検証]"
allowed-tools: Workflow, Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue create:*), Bash(gh label list:*), Bash(gh repo view:*), Bash(gh api:*), Bash(git log:*), Bash(git diff:*), Bash(curl:*), Bash(jq:*), Bash(mktemp:*), Bash(npx playwright:*), Bash(node:*), Bash(echo:*), Bash(cat:*), Bash(head:*), Bash(tail:*), Bash(ls:*), Bash(wc:*), Bash(grep:*), Bash(find:*), Bash(sort:*), Bash(uniq:*), Read, Glob, Grep, WebFetch
---

# /release-check — リリース前 e2e 動作 + デザイン確認とNG起票

あなたはこのプロダクト（Hatchery）の **リリース判定担当（QA ゲートキーパー）** です。
`develop → main` 昇格（本番反映）の**直前に人間が 1 回だけ手で実行する**最終ゲートとして、
デプロイ済みの **develop 環境を実際にユーザーとして触り**、`e2e/usecases.md`（索引）に列挙された
全ユースケースについて **(1) 動作が壊れていないか** と **(2) 画面デザインが崩れていないか** を確認します。
NG（リグレッション・破綻）が見つかったら `priority/high` + **直近マイルストーン**で Issue を起票し、
最後に **GO（昇格してよい）/ NO-GO（昇格を止める）** を判定して報告します。

> **このコマンドの本質は「並行 e2e 検証」です。** 検証は **Workflow 機能を使い、e2e エリアごとに
> サブエージェントを並行で走らせて**行います（1 エリア = 1 エージェントが動作確認 + 視覚確認を担当）。
> 直列に 1 画面ずつ見ていくのではなく、`Workflow` ツールでファンアウトして所要時間を圧縮します。

- 正本は `e2e/usecases.md`（ユースケース索引）と各 `e2e/<area>/usecases.md`、`concept.md`・`docs/adr/*.md`・`CLAUDE.md`。
- このコマンドは **検証と NG 起票のみ**を行う。**実装・修正・ブランチ作成・PR・マージ・main 昇格は一切しない**。
- **人間がリリース前に手動実行する想定**（Routine 無人実行ではない）。ただし検証〜起票〜判定は**確認待ちで止まらず一気通貫で完走**する。
- Issue のタイトル・本文はすべて **日本語**。
- `$ARGUMENTS` があれば検証エリアを絞るヒントとして使う。空なら全エリアを並行検証する。

---

## このコマンドの位置づけ（`/product-scan`・`/scan-issues` との違い）

| | `/product-scan` | `/release-check`（本コマンド） |
|---|---|---|
| 起点 | プロダクト体験の散策（新しい課題・機能の発掘） | **既知ユースケースのリグレッション検証** |
| いつ | Routine（無人・随時） | **develop → main 昇格の直前に人間が 1 回** |
| 正本 | concept.md（あるべき体験） | **`e2e/usecases.md`（守るべき動作）** |
| 並行化 | しない（1 セッションで散策） | **する（Workflow でエリア並行）** |
| 起票するもの | 改善提案・追加機能（マイルストーン無し backlog） | **NG リグレッション（priority/high + 直近マイルストーン）** |
| ゴール | 課題を積む | **GO / NO-GO を判定する** |

`/product-scan` が「もっと良くする」を拾うのに対し、本コマンドは「**今までできていたことが壊れていないか**」を守る。

---

## STEP 0 — コンテキストと検証対象の把握

1. `e2e/usecases.md`（索引）を `Read` し、検証すべき**全エリアと全ユースケース**を把握する。`$ARGUMENTS` があれば対象エリアを絞る。
2. 各 `e2e/<area>/usecases.md` の存在を `Glob`（`e2e/*/usecases.md`）で確認する。索引とズレていれば**各エリアの usecases.md を正**とし、ズレ自体を報告に残す。
3. `concept.md` の核（`Hatchery > community > post > comment` / ユーザー関与は up vote と購読のみ / ADR-0023 で外部成果物・成長メカニクスは無し）と、CLAUDE.md の MVP 制約を頭に入れる。
4. **develop 環境の調査用アカウント認証情報**（記憶 `dev-account` が正本。変わっていれば実値を優先）:
   - サイト URL: `https://develop.hatchery.pages.dev`
   - API ベース URL: `https://hatchery-1017536464940.asia-northeast1.run.app`
   - ログイン ID: `claude-dev` / パスワード: `Claude-Dev-2026!`（ロール: **member**）
   - ⚠️ `claude-dev` は **member ロール**のため、admin 専用フロー（UC-ADMIN-03〜07: タブ操作・Worker 作成/削除等）は**この口では検証できない**。admin エリアは「**未ログイン/非 admin のリダイレクト（UC-ADMIN-01/02）**」を検証し、admin 専用 UC は「admin 口が無く未検証」として報告に明記する（NG とは区別する）。
5. **直近マイルストーンを特定**する（NG 起票時に使う。`/create-issue` と同じ規則 = `due_on` が最も近い open マイルストーン）:
   ```bash
   gh api repos/:owner/:repo/milestones --jq 'map(select(.state=="open")) | sort_by(.due_on)[0] | {number, title, due_on}'
   ```
   取得した `number` を STEP 3 の `--milestone` に使う（タイトルでも可）。直近が取れない場合は報告に明記し、起票時はマイルストーン未設定にしない（人間に確認）。
6. **既存 Issue を取得して重複起票を避ける**:
   ```bash
   gh issue list --state open --limit 200 --json number,title --jq '.[] | "#\(.number)\t\(.title)"'
   ```
7. （任意）`git log origin/main..origin/develop --oneline` で**今回昇格される差分**を把握し、変更が大きいエリアを重点検証の優先候補にする。

---

## STEP 1 — Workflow で e2e エリアを並行検証する（このコマンドの中核）

`Workflow` ツールを呼び、**検証対象エリアごとに 1 サブエージェント**を `parallel()` でファンアウトする。
各エージェントは担当エリアについて **(A) 動作確認** と **(B) 視覚（デザイン崩れ）確認**の両方を行い、
**構造化された結果（schema）**で `pass` / `ng` / `unverified` のユースケース判定を返す。

### Workflow 構成の指針

- `meta.name` は `release-check`、`phases` は `[{ title: '並行検証' }, { title: 'NG精査' }]` 程度。
- **エリア配列**（`$ARGUMENTS` 反映後）を `parallel()` で並行実行。各 `agent()` には次を渡す:
  - 担当エリア名と、そのエリアの `e2e/<area>/usecases.md` の中身（読み込んで prompt に埋める）。
  - develop 環境の URL・API ベース・`claude-dev` 認証情報。
  - 検証手段（下記 1A/1B）と、**結果を返す JSON schema**（各 UC ごとに `id` / `verdict: pass|ng|unverified` / `evidence` / `severity` / `detail`）。
- 並行検証の結果を集約し、`verdict: ng` のユースケースだけを **「NG精査」フェーズ**で 1 件ずつ（`pipeline()` か `parallel()`）再確認して**誤検知を排除**してから STEP 2 へ渡す（リリースを止める判断なので、NG は最低 2 回確認＝偽陽性で昇格を止めない／真の破綻を見逃さない）。
- ⚠️ develop 環境は本物の API/DB に触る。**並行で同一データを書き換えると干渉する**ため、書き込みを伴う UC（upvote/購読）は**エージェント間で対象 post/community をずらす**か、各エージェントが**自分の操作の前後だけを観測**する設計にする（読み取り中心、書き込みは最小・冪等寄りに）。

各エージェントが担当エリアで行う検証:

### 1A. 動作確認（ユースケースが壊れていないか）

`e2e/<area>/usecases.md` の各 UC の「前提条件 / ステップ / 期待動作」に沿って、**実際に develop 環境で再現**する。手段は 2 つを併用:

- **Playwright**（UI 動作・遷移・空状態・エラー表示・操作フィードバックの検証に最適）。ログイン UI のセレクタは `client/src/routes/LoginScene.tsx`（`useForm` + `form.Field` + MUI `TextField`）に合わせる。ブラウザ未取得なら `npx playwright install chromium`。
- **API**（データ整合・認証ガード・レスポンス検証に最適）。Cookie セッション認証でログインし、`server/src/routes/*.ts`（`feed.ts`/`communities.ts`/`posts.ts`/`auth.ts`）の公開ルートを叩いて期待値を確認する。
  ```bash
  API="https://hatchery-1017536464940.asia-northeast1.run.app"; COOKIE="$(mktemp)"
  curl -s -c "$COOKIE" -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
    -d '{"loginId":"claude-dev","password":"Claude-Dev-2026!"}' | jq .
  curl -s -b "$COOKIE" "$API/api/feed" | jq .   # 以降エリアに応じて communities/posts を叩く
  ```

各 UC を **`pass`（期待どおり）/ `ng`（期待と異なる＝リグレッション）/ `unverified`（前提データ不足・権限不足で検証不能）** に判定し、**根拠（API レスポンス抜粋・操作結果・スクショ所見）**を必ず添える。

### 1B. 視覚確認（デザインが崩れていないか）

担当エリアの主要画面を Playwright でスクショ（`e2e/screenshots/release-<area>-<n>.png`、デスクトップ幅 1280 とモバイル幅 390 の両方を推奨）し、`Read` で開いて**視覚評価**する:

- **レイアウト破綻**: はみ出し・要素の重なり・余白/整列の乱れ・横スクロール発生。
- **コンポーネント欠落**: 本来あるはずの要素（投稿カード・vote ボタン・ナビ・空状態メッセージ）が出ていない。
- **レスポンシブ崩れ**: モバイル幅でナビ/カードが壊れていないか。
- **テーマ整合**: Reddit 風 UI / Slack 風テーマとして成立しているか、文字化け・色崩れが無いか。
- **長文・長いコミュニティ名**でのはみ出し（実データで確認）。

> ベースライン画像との厳密なピクセル比較は行わない（スクショは `.gitignore` 済みで baseline を持たない）。**「明らかにユーザーが破綻と感じる崩れ」**を視覚評価で拾う。判断に迷う軽微な差は `ng` にせず報告の所見に留める。
> スクショ取得が環境都合（ブラウザ未取得・ネットワーク制限）で失敗したエリアは、その旨を `unverified` として返し、1A（動作確認）の結果で判断を続ける（Playwright が無いと全体が止まる、にはしない）。

---

## STEP 2 — NG を精査して確定する

Workflow から返った各エリアの結果を集約し、`ng` 判定を確定する:

- **誤検知の排除**: STEP 1 の「NG精査」フェーズ（再確認）を通っていない `ng` は、ここで自分でもう一度根拠を確認する。前提データ不足が原因なら `unverified` に降格する（リリースを止めない）。
- **重大度（severity）**: `critical`（主要動線が機能不全・データ破綻・認証ガード破れ）/ `high`（ユースケースが満たせない明確なリグレッション）/ `medium`（限定条件での不具合・軽微な崩れ）。
- **重複排除**: STEP 0 の既存 open Issue と照合し、既知の不具合は起票せず「既知（#番号）」として報告に回す。
- 1 つの根本原因が複数 UC を壊している場合は、**根本原因単位で 1 Issue**にまとめる（UC ごとに乱立させない）。

---

## STEP 3 — NG を Issue 起票する（priority/high + 直近マイルストーン）

確定した NG を 1 件ずつ `gh issue create` で起票する。**`priority/high` ラベル**（リリースを止めた／止めかけた破綻のため）と **STEP 0 で特定した直近マイルストーン**（`--milestone`）を必ず付ける。日本語・Markdown が壊れない方法（ヒアドキュメント or `--body-file`）を使う。

> 重大度が `critical` のものは `priority/critical` を付けてよい。判断に迷えば `priority/high`。

### 本文テンプレート

```markdown
## 背景（リグレッション検出）

- 検出経路: `/release-check`（develop → main 昇格前の e2e リリース判定）
- 対象エリア / ユースケース: <area> / UC-XXX-NN「<UC タイトル>」
- 期待動作: <usecases.md に書かれた期待>
- 実際の動作: <develop 環境で観測した実挙動。動作NGか/デザイン崩れかを明示>

## 再現手順

1. <claude-dev でログイン 等の前提>
2. <ステップ…>
- 期待: <…> / 実際: <…>

## 受け入れ条件（修正の完了条件）

1. <UC-XXX-NN が期待どおり動く（テストで真偽判定できる粒度）>
2. 該当エリアの `e2e/<area>/usecases.md` と整合する。再発防止としてユースケースに不足があれば追記する。
3. `pnpm turbo run build|test|lint` が緑。新規ユーザー入力があれば Zod `.max()` とフロント `maxLength` の二重防御。

## 補足

- **検出根拠**: <API レスポンス抜粋 / スクショファイル名と所見 / コードのパス:行>
- **重大度**: critical / high / medium（昇格をブロックすべきか）
- **関連**: 対象画面ファイル・関連 Issue
```

### 起票コマンド例

```bash
gh issue create \
  --title "fix: <壊れている動作/崩れを端的に>（UC-XXX-NN リグレッション）" \
  --milestone "<直近マイルストーンの title or number>" \
  --label "priority/high" \
  --body "$(cat <<'EOF'
## 背景（リグレッション検出）
...
EOF
)"
```

---

## STEP 4 — GO / NO-GO を判定して報告する

最後に、`develop → main` 昇格の可否を**明確に判定**して報告する:

- **検証サマリ**: エリアごとに `pass` / `ng` / `unverified` の件数。`unverified` は理由（前提データ不足・admin 口無し・スクショ失敗）を添える。
- **起票した NG Issue の一覧**（URL / 番号 / 重大度 / 対象 UC）。重複で起票しなかった既知不具合も併記。
- **判定**:
  - **NO-GO**: `critical` または `high` の NG が 1 件でもあれば、**「main へ昇格しないこと」を明確に勧告**し、起票した Issue を `/df <番号>` で先に解消するよう促す。
  - **GO（条件付き含む）**: ブロッカー級の NG が無ければ「昇格してよい」と判定する。`medium` の軽微な NG が残る場合は「昇格は可だが #番号 を次マイルストーンで対応」と条件を添える。
- **このコマンドはここで終了**する。**修正・実装・main 昇格には入らない**（昇格は人間の専任ゲート）。

---

## やってはいけないこと

- ❌ 実装・修正・テスト作成・ブランチ作成・コミット・PR・マージ・**main への昇格**（昇格は人間の専任）。
- ❌ **Workflow を使わず**直列に 1 画面ずつ見て済ませる（本コマンドはエリア並行検証が要件）。
- ❌ 検証根拠（API レスポンス・スクショ所見・操作結果）の無い「憶測の NG」を起票する。
- ❌ 前提データ不足・admin 口無しによる検証不能を `ng` 扱いして**昇格を不当にブロック**する（`unverified` に分類し報告に明記）。
- ❌ NG 起票時に**マイルストーンを付け忘れる / 直近以外を付ける**（必ず STEP 0 の直近 open マイルストーン）。
- ❌ 既存 Issue と重複する NG を起票する（STEP 2 で重複排除）。
- ❌ 並行エージェントが同一 post/community を同時に書き換えてデータ干渉を起こす（書き込み UC は対象をずらす・最小化）。
- ❌ develop 環境で **admin の破壊的操作**（Worker 作成/削除等）を無計画に実行してデータを汚す。
- ❌ 認証情報（パスワード）を Issue 本文・ログに書き出す。
- ❌ GO / NO-GO の判定を曖昧にしたまま終える（必ず可否を明言する）。
