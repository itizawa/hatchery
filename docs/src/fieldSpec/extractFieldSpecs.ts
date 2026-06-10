import type { ZodTypeAny, ZodObject, ZodRawShape } from "zod";

import type { FieldConstraints, FieldSpec } from "./types.js";

/** 文字列フォーマット系の check kind（min/max 以外）。 */
const STRING_FORMAT_KINDS = new Set([
  "url",
  "email",
  "uuid",
  "cuid",
  "cuid2",
  "ulid",
  "datetime",
  "date",
  "time",
  "ip",
  "emoji",
  "regex",
]);

const WRAPPER_TYPE_NAMES = new Set(["ZodOptional", "ZodNullable", "ZodDefault"]);

/** Optional / Default / Nullable のラッパーを剥がして基底スキーマを返す。 */
function unwrap(schema: ZodTypeAny): ZodTypeAny {
  let current = schema;
  // 多重ラップ（例: .optional().nullable()）にも耐える。
  while (WRAPPER_TYPE_NAMES.has(current._def?.typeName as string)) {
    current = current._def.innerType as ZodTypeAny;
  }
  return current;
}

/** Zod の typeName を表示用の基底型名へ写す。 */
function baseTypeName(schema: ZodTypeAny): string {
  const typeName = (schema._def?.typeName as string | undefined) ?? "";
  switch (typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodDate":
      return "date";
    case "ZodEnum":
      return "enum";
    case "ZodNativeEnum":
      return "enum";
    default:
      // ZodFoo → foo（フォールバック）。
      return typeName.replace(/^Zod/, "").toLowerCase() || "unknown";
  }
}

/** 基底スキーマから制約（min/max/format/enum/int/positive）を抽出する。 */
function extractConstraints(schema: ZodTypeAny): FieldConstraints {
  const constraints: FieldConstraints = {};
  const def = schema._def as { typeName?: string; checks?: unknown[]; values?: unknown[] } | undefined;

  // enum
  if (def?.typeName === "ZodEnum" && Array.isArray(def.values)) {
    constraints.enum = def.values.map((v) => String(v));
  }

  const checks = (def?.checks ?? []) as Array<{
    kind?: string;
    value?: number;
    inclusive?: boolean;
  }>;
  for (const check of checks) {
    switch (check.kind) {
      case "min":
        if (typeof check.value === "number") constraints.min = check.value;
        break;
      case "max":
        if (typeof check.value === "number") constraints.max = check.value;
        break;
      case "int":
        constraints.int = true;
        break;
      default:
        if (check.kind && STRING_FORMAT_KINDS.has(check.kind)) {
          constraints.format = check.kind;
        }
        break;
    }
  }

  // z.number().positive() は { kind:"min", value:0, inclusive:false } として表現される。
  // これを positive フラグとして表現し、min:0 は制約から落とす（実質的な意味は positive）。
  if (def?.typeName === "ZodNumber") {
    const positiveCheck = checks.find(
      (c) => c.kind === "min" && c.value === 0 && c.inclusive === false,
    );
    if (positiveCheck) {
      constraints.positive = true;
      if (constraints.min === 0) delete constraints.min;
    }
  }

  return constraints;
}

/** 単一フィールドのスキーマから FieldSpec を組み立てる。 */
function toFieldSpec(name: string, schema: ZodTypeAny): FieldSpec {
  const base = unwrap(schema);
  const spec: FieldSpec = {
    name,
    type: baseTypeName(base),
    required: !schema.isOptional(),
    constraints: extractConstraints(base),
  };
  // 説明はラッパー側 / 基底側のどちらに付いていても拾う。
  const description = schema.description ?? base.description;
  if (description != null) {
    spec.description = description;
  }
  return spec;
}

/**
 * Zod の `z.object(...)` から各入力フィールドの項目仕様（FieldSpec）を抽出する。
 *
 * Zod 定義（型・必須・min/max・format・enum・description）を正本に、
 * 画面項目一覧を「生成由来」で得るための純粋関数（Issue #201）。
 */
export function extractFieldSpecs(schema: ZodObject<ZodRawShape>): FieldSpec[] {
  const shape = schema.shape;
  return Object.entries(shape).map(([name, field]) =>
    toFieldSpec(name, field as ZodTypeAny),
  );
}
