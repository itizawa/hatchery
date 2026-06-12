# ADR-0026: アクセス数計測ツールの選定（Cloudflare Web Analytics 採用）

- ステータス: Accepted
- 日付: 2026-06-12
- 関連 Issue: #235

## コンテキスト（背景）

Hatchery は Cloudflare Pages でホストされている Vite + React 19 の SPA（ADR-0003 / ADR-0008）。プロダクト公開に向けて「モニターが 3 日覗き続けるか」という検証指標（concept.md §9-10）を定量的に確かめるため、PV/UU・再訪・滞在などを計測できるアクセス解析ツールを選定する必要がある。

構成上の制約:
- クライアントは **Vite + React 19 の SPA（SSR なし）**（ADR-0003）。ページ遷移は TanStack Router によるクライアントサイドルーティングのため、`<a>` タグのページロードではなく JavaScript でのルート遷移を計測できる必要がある
- ホスティングは **Cloudflare Pages**（ADR-0008）
- プライバシー / Cookie 同意・GDPR 対応のコストを最小化したい
- MVP 段階のため、低コスト（理想は無料）で導入容易なものを優先する

本 ADR は技術選定のみを扱う。実際の計測タグ埋め込み・SDK 導入は**別 Issue（本 ADR 完了後に別途起票）**で対応する。

## 決定

**Cloudflare Web Analytics を採用する。**

- Cloudflare Pages のダッシュボードから有効化し、`<head>` にビーコンスクリプト 1 行を追加する
- SPA のルート遷移計測は、TanStack Router のナビゲーションフックから `window.__cfBeacon.push({ type: 'page' })` を呼び出す形で別 Issue で実装する
- Cookie を使用せず GDPR 同意バナーは不要

## 理由

| 観点 | Cloudflare Web Analytics |
|------|-------------------------|
| SPA 対応 | ビーコン API 経由でルート遷移イベントを手動送信可能 |
| プライバシー / Cookie | Cookie **なし**、GDPR 同意バナー**不要** |
| コスト | **完全無料**（Cloudflare Pages に内包） |
| 導入容易性 | Cloudflare ダッシュボードで有効化 + スクリプト 1 行 |
| データ所有 | Cloudflare ダッシュボードで閲覧（エクスポート制限あり） |
| インフラ親和性 | 既存 Cloudflare Pages 構成（ADR-0008）と完全統合 |

既存インフラとして Cloudflare Pages を採用済みであり（ADR-0008）、追加料金なし・最小実装量でアクセス計測を導入できるのが最大の決め手。Cookie を使用しない点もプライバシー対応コストを削減する。

## 検討した代替案

- **Google Analytics 4 (GA4)**: SPA のページ遷移計測に公式対応しており機能が豊富だが、Cookie を使用するため GDPR 準拠の同意バナー実装が必要になる。また Google へのデータ依存というプライバシー上のリスクがある。コストは無料だが、同意 UI の実装・運用コストが問題。採用しない。

- **Plausible Analytics**: Cookie なし・GDPR 準拠で SPA を自動追跡（history API 監視）するが、クラウド版は月額 $9〜の有料プランが必要。セルフホスト版はサーバインフラが別途必要になり、MVP 段階のコスト・運用負荷が増す。採用しない。

- **Umami**: Cookie なし・GDPR 準拠・オープンソース。クラウド版（Umami Cloud）は無料枠（10 万 PV/月）があり SPA を自動追跡するが、外部サービスへの依存が生じる。セルフホスト版は自社インフラ管理が必要。Cloudflare Web Analytics と比べてインフラ統合面で劣る。採用しない。

- **PostHog**: 機能が非常に豊富（ファネル分析・セッションリプレイ等）だが、MVP 段階のプロダクト指標把握には過剰。Cookie を使用する（オプトアウト可能だが設定が必要）。無料枠（100 万イベント/月）はあるが、SDK 導入の実装量が多い。採用しない。

## 影響（結果）

- **良い影響**:
  - 追加コストゼロ
  - Cookie なし・GDPR 準拠のため同意バナー実装が不要
  - Cloudflare Pages の既存インフラに統合され、管理画面も統一される

- **トレードオフ / 注意点**:
  - SPA ルート遷移計測は自動ではなく手動実装が必要（TanStack Router との統合コードが必要）
  - 詳細なファネル分析やセッションリプレイなどの高度な機能は提供されない
  - データエクスポートに制限がある（GA4 等と比較してデータポータビリティが低い）

- **フォローアップが必要なこと**:
  - 別 Issue: Cloudflare Web Analytics の実際の導入（`<head>` スクリプト追加、TanStack Router との統合によるルート遷移計測の実装）
