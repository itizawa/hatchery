/**
 * MVP の静的な発言テンプレート（#32）。社員 id ごとの文言リスト。
 * 定時バッチが「複数社員 × ランダム選択」で発言を組み立てる際の素材として使う。
 * AI による生成への移行は別 Issue（#53）。それまでの単一情報源として common に置く（ADR-0005）。
 *
 * id は DEFAULT_EMPLOYEES（haru / ken / mei）と整合させる。各文言は MessageSchema を満たすよう
 * 非空かつ MAX_MESSAGE_LENGTH 以内に収める。
 */
export const EMPLOYEE_MESSAGE_TEMPLATES: Readonly<Record<string, readonly string[]>> = {
  haru: [
    "おはようございます！今日も一日がんばりましょう。",
    "いい天気ですね、気分が上がります。",
    "ちょっと休憩しませんか？コーヒーでもどうぞ。",
    "みんなのおかげで今日も楽しいです！",
  ],
  ken: [
    "進捗はどうですか。困ったら声をかけてください。",
    "昔似たような案件をやったことがあります。",
    "焦らず一つずつ片付けていきましょう。",
    "そのアプローチ、悪くないと思いますよ。",
  ],
  mei: [
    "なるほど、勉強になります！",
    "ここはどう進めるのが良いでしょうか？",
    "やってみます、ありがとうございます！",
    "新しいこと、少しずつ覚えてきました。",
  ],
};

/** 社員 id に対応するテンプレート群を返す。未知 id は空配列（呼び出し側でスキップ可能）。 */
export const getEmployeeMessageTemplates = (employeeId: string): readonly string[] =>
  EMPLOYEE_MESSAGE_TEMPLATES[employeeId] ?? [];
