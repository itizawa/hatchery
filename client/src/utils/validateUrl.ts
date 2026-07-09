/**
 * URL 形式のフォームフィールド用バリデータ（@tanstack/react-form の onChange/onBlur validator）。
 * 空文字は有効（任意項目）として扱う。AccountScene の avatarUrl・CommunityFormFields の feedUrl で共有する。
 */
export function validateUrl(value: string): string | undefined {
  if (!value) return undefined;
  return URL.canParse(value) ? undefined : "有効な URL を入力してください";
}
