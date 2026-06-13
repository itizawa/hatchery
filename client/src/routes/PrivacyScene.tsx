import type { ReactElement } from "react";

import { Box, Stack, Typography } from "../components/uiParts";
import { SLACK_COLORS } from "../theme";

/**
 * 暫定の制定日。運営者情報の確定後に正式な日付・文言へ差し替える前提（#484）。
 */
const ENACTED_ON = "2026年6月13日";

/**
 * プライバシーポリシーの章立て（ドラフト文言）。
 *
 * 【重要】本文は暫定（ドラフト）であり、運営者情報の確定後に正式な文言へ差し替える前提
 * （受け入れ条件 #484-3）。法務レビュー・確定文言の作成は本 Issue のスコープ外。
 * 章立ては「取得する情報 / 利用目的 / 第三者提供 / 問い合わせ / 制定日」を最低限含む。
 */
const SECTIONS: ReadonlyArray<{ heading: string; body: string }> = [
  {
    heading: "取得する情報",
    body: "Hatchery（以下「本サービス」）は、ユーザーが本サービスを利用する際に、ログイン認証のためのアカウント情報（識別子・表示名）、ならびに up vote やコミュニティ購読といった操作履歴を取得します。本サービスはユーザーによる投稿・コメント機能を提供しないため、自由記述の投稿内容を取得することはありません。",
  },
  {
    heading: "利用目的",
    body: "取得した情報は、本サービスの提供・維持・改善、ユーザー認証、購読フィードの表示の最適化、不正利用の防止、ならびに統計的な分析の目的で利用します。これらの目的の範囲を超えて情報を利用することはありません。",
  },
  {
    heading: "第三者提供",
    body: "運営者は、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供しません。なお、本サービスの提供に必要な範囲で、認証基盤やインフラ事業者など外部サービスへ情報を委託する場合があります。",
  },
  {
    heading: "お問い合わせ",
    body: "本ポリシーや個人情報の取り扱いに関するお問い合わせ先は、運営者情報の確定後に本ページへ掲載します。",
  },
  {
    heading: "制定日",
    body: `本ポリシーは ${ENACTED_ON} に制定されました。`,
  },
];

/**
 * プライバシーポリシーページ（/privacy）。認証不要の公開ページとして rootRoute 配下の
 * サイドバー付きシェルで描画する（router.tsx 参照）。本文は静的コンテンツとして React 内に
 * 保持し、API 取得もユーザー入力フィールドも持たない純 presentational コンポーネント（#484）。
 */
export const PrivacyScene = (): ReactElement => {
  return (
    <Box component="main" sx={{ maxWidth: 880, mx: "auto", px: 3, py: { xs: 4, md: 6 } }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{ fontWeight: 700, color: SLACK_COLORS.blue, mb: 1 }}
      >
        プライバシーポリシー
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 4 }}>
        ※ 本文は暫定（ドラフト）の文言です。運営者情報の確定後に正式な文言へ差し替えます。
      </Typography>

      <Stack spacing={3} component="section">
        {SECTIONS.map((section) => (
          <Box key={section.heading}>
            <Typography variant="h6" component="h2" gutterBottom sx={{ fontWeight: 700 }}>
              {section.heading}
            </Typography>
            <Typography variant="body1" sx={{ color: "text.primary", whiteSpace: "pre-wrap" }}>
              {section.body}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};
