/**
 * 画面項目（入力フィールド）一覧の型定義（Issue #201）。
 *
 * `common` の Zod 入力スキーマを正本に、フォームの入力項目メタデータを
 * 表現する。手書きではなく `extractFieldSpecs` による生成由来であることが前提。
 */

/** フィールドの制約（min・max・format・enum 等）。該当しないキーは省略する。 */
export type FieldConstraints = {
  /** 文字列長 / 数値の下限（z.string().min / z.number().min）。 */
  min?: number;
  /** 文字列長 / 数値の上限（z.string().max / z.number().max）。#91 の桁数。 */
  max?: number;
  /** 文字列フォーマット（url / email / uuid / datetime 等）。 */
  format?: string;
  /** enum の取りうる値。 */
  enum?: string[];
  /** 整数制約（z.number().int()）。 */
  int?: boolean;
  /** 正数制約（z.number().positive()）。 */
  positive?: boolean;
};

/** 1 入力フィールドの項目仕様。 */
export type FieldSpec = {
  /** 項目名（Zod object のキー）。 */
  name: string;
  /** 基底型（string / number / boolean / enum / date 等）。 */
  type: string;
  /** 必須かどうか（optional / default 付きは false）。 */
  required: boolean;
  /** 制約。 */
  constraints: FieldConstraints;
  /** 説明（z.describe() 由来。無ければ省略）。 */
  description?: string;
};

/** 1 フォーム（= 1 入力系スキーマ）の項目一覧。 */
export type FormSpec = {
  /** スキーマ識別子（例: "LoginRequestSchema"）。 */
  id: string;
  /** 画面表示用のタイトル（日本語）。 */
  title: string;
  /** フォームの説明（任意）。 */
  description?: string;
  /** 抽出された入力フィールド一覧。 */
  fields: FieldSpec[];
};
