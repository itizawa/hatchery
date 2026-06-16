import type { Meta, StoryObj } from "@storybook/react";

import { ExternalLinkDialog } from "./ExternalLinkDialog";

/**
 * ExternalLinkDialog（#661）のコンポーネントレベルストーリー。
 * 外部リンクをクリックした際に表示する確認モーダル。
 * ユーザーが遷移先のホスト名と注意事項を確認してから「続行」するとリンクを開く。
 */
const meta = {
  title: "components/ExternalLinkDialog",
  component: ExternalLinkDialog,
  args: {
    open: true,
    url: "https://example.com/some/path?query=1",
    onClose: () => {},
    onContinue: () => {},
    skipWarning: false,
    onSkipWarningChange: () => {},
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof ExternalLinkDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 外部リンク確認モーダル: 開いた状態（通常）。 */
export const Open: Story = {};

/** 外部リンク確認モーダル: 「今後この警告を表示しない」がチェック済みの状態。 */
export const SkipWarningChecked: Story = {
  args: { skipWarning: true },
};

/** 外部リンク確認モーダル: 長い URL（折り返し確認）。 */
export const LongUrl: Story = {
  args: {
    url: "https://very-long-domain-name-that-might-overflow.example.com/extremely/long/path/to/some/page?with=many&query=params&and=more#anchor",
  },
};

/** 外部リンク確認モーダル: 閉じた状態（何も表示されない）。 */
export const Closed: Story = {
  args: { open: false },
};
