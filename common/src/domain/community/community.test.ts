import { describe, expect, it } from "vitest";

import {
  AdminCommunitySchema,
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
  COMMUNITY_SLUG_MAX_LENGTH,
  CommunitySchema,
  CreateCommunitySchema,
  UpdateCommunitySchema,
} from "./community.js";

describe("CommunitySchema", () => {
  const validCommunity = {
    id: "comm-1",
    slug: "ai-workers",
    name: "AI ワーカー雑談",
    description: "AI ワーカーたちが日常を語るコミュニティ",
    synopsis: "これまでのあらすじ",
    last_slot_key: "2026-06-10T09:00:00.000Z",
    created_at: new Date("2026-06-01T00:00:00.000Z"),
  };

  it("有効なコミュニティをパースできる", () => {
    const result = CommunitySchema.safeParse(validCommunity);
    expect(result.success).toBe(true);
  });

  it("id を持つ", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.id).toBe("comm-1");
  });

  it("slug を持つ（最大50文字）", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.slug).toBe("ai-workers");
  });

  it("slug が 50 文字を超えると reject する", () => {
    const data = { ...validCommunity, slug: "a".repeat(51) };
    expect(CommunitySchema.safeParse(data).success).toBe(false);
  });

  it("name を持つ（最大50文字）", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.name).toBe("AI ワーカー雑談");
  });

  it("name が 50 文字を超えると reject する", () => {
    const data = { ...validCommunity, name: "あ".repeat(51) };
    expect(CommunitySchema.safeParse(data).success).toBe(false);
  });

  it("description を持つ（最大500文字）", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.description).toBe("AI ワーカーたちが日常を語るコミュニティ");
  });

  it("description が 500 文字を超えると reject する", () => {
    const data = { ...validCommunity, description: "あ".repeat(501) };
    expect(CommunitySchema.safeParse(data).success).toBe(false);
  });

  it("synopsis を持つ", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.synopsis).toBe("これまでのあらすじ");
  });

  it("synopsis は省略可能（optional）", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { synopsis: _s, ...dataWithoutSynopsis } = validCommunity;
    const result = CommunitySchema.safeParse(dataWithoutSynopsis);
    expect(result.success).toBe(true);
  });

  it("last_slot_key を持つ", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.last_slot_key).toBe("2026-06-10T09:00:00.000Z");
  });

  it("last_slot_key は省略可能（optional）", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { last_slot_key: _l, ...dataWithoutLastSlot } = validCommunity;
    const result = CommunitySchema.safeParse(dataWithoutLastSlot);
    expect(result.success).toBe(true);
  });

  it("created_at を持つ", () => {
    const result = CommunitySchema.parse(validCommunity);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  describe("slug フォーマットバリデーション（#310）", () => {
    it("小文字英字のみ（1文字）を受け入れる", () => {
      expect(CommunitySchema.safeParse({ ...validCommunity, slug: "a" }).success).toBe(true);
    });

    it("小文字英数字のみを受け入れる", () => {
      expect(CommunitySchema.safeParse({ ...validCommunity, slug: "techie123" }).success).toBe(true);
    });

    it("ハイフンを含む slug を受け入れる", () => {
      expect(CommunitySchema.safeParse({ ...validCommunity, slug: "tech-news-2026" }).success).toBe(true);
    });

    it(`slug が ${COMMUNITY_SLUG_MAX_LENGTH} 文字ちょうどを受け入れる`, () => {
      const maxSlug = "a".repeat(COMMUNITY_SLUG_MAX_LENGTH);
      expect(CommunitySchema.safeParse({ ...validCommunity, slug: maxSlug }).success).toBe(true);
    });

    it("大文字を含む slug は拒否する", () => {
      expect(CommunitySchema.safeParse({ ...validCommunity, slug: "TechNews" }).success).toBe(false);
    });

    it("アンダースコアを含む slug は拒否する", () => {
      expect(CommunitySchema.safeParse({ ...validCommunity, slug: "tech_news" }).success).toBe(false);
    });

    it("ハイフン始まりの slug は拒否する", () => {
      expect(CommunitySchema.safeParse({ ...validCommunity, slug: "-tech" }).success).toBe(false);
    });

    it("ハイフン終わりの slug は拒否する", () => {
      expect(CommunitySchema.safeParse({ ...validCommunity, slug: "tech-" }).success).toBe(false);
    });

    it("スペースを含む slug は拒否する", () => {
      expect(CommunitySchema.safeParse({ ...validCommunity, slug: "tech news" }).success).toBe(false);
    });
  });
});

describe("CreateCommunitySchema（#310）", () => {
  const valid = {
    slug: "new-community",
    name: "新コミュニティ",
    description: "テスト用コミュニティです。",
  };

  it("有効な作成リクエストを受け入れる", () => {
    expect(CreateCommunitySchema.safeParse(valid).success).toBe(true);
  });

  it("id / created_at が含まれていなくても受け入れる", () => {
    const result = CreateCommunitySchema.parse(valid);
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("created_at");
  });

  it("slug バリデーション違反（大文字）は拒否する", () => {
    expect(CreateCommunitySchema.safeParse({ ...valid, slug: "NewCommunity" }).success).toBe(false);
  });

  it("空の slug は拒否する", () => {
    expect(CreateCommunitySchema.safeParse({ ...valid, slug: "" }).success).toBe(false);
  });

  it("name が必須", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _name, ...rest } = valid;
    expect(CreateCommunitySchema.safeParse(rest).success).toBe(false);
  });

  it("description が必須", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { description: _desc, ...rest } = valid;
    expect(CreateCommunitySchema.safeParse(rest).success).toBe(false);
  });

  it(`slug が ${COMMUNITY_SLUG_MAX_LENGTH} 文字を超えると拒否する`, () => {
    const longSlug = "a".repeat(COMMUNITY_SLUG_MAX_LENGTH + 1);
    expect(CreateCommunitySchema.safeParse({ ...valid, slug: longSlug }).success).toBe(false);
  });

  it(`name が ${COMMUNITY_NAME_MAX_LENGTH} 文字を超えると拒否する`, () => {
    const longName = "a".repeat(COMMUNITY_NAME_MAX_LENGTH + 1);
    expect(CreateCommunitySchema.safeParse({ ...valid, name: longName }).success).toBe(false);
  });

  it(`description が ${COMMUNITY_DESCRIPTION_MAX_LENGTH} 文字を超えると拒否する`, () => {
    const longDesc = "a".repeat(COMMUNITY_DESCRIPTION_MAX_LENGTH + 1);
    expect(CreateCommunitySchema.safeParse({ ...valid, description: longDesc }).success).toBe(false);
  });

  it("generationInstruction を省略できる（optional）", () => {
    expect(CreateCommunitySchema.safeParse(valid).success).toBe(true);
  });

  it("generationInstruction を指定できる", () => {
    expect(
      CreateCommunitySchema.safeParse({ ...valid, generationInstruction: "脱さん付け指示" }).success,
    ).toBe(true);
  });

  it(`generationInstruction が ${COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH} 文字を超えると拒否する（#91）`, () => {
    const longInstr = "a".repeat(COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH + 1);
    expect(
      CreateCommunitySchema.safeParse({ ...valid, generationInstruction: longInstr }).success,
    ).toBe(false);
  });
});

describe("UpdateCommunitySchema（#310）", () => {
  it("name のみの更新を受け入れる", () => {
    expect(UpdateCommunitySchema.safeParse({ name: "新しい名前" }).success).toBe(true);
  });

  it("description のみの更新を受け入れる", () => {
    expect(UpdateCommunitySchema.safeParse({ description: "新しい説明" }).success).toBe(true);
  });

  it("name と description 両方の更新を受け入れる", () => {
    expect(UpdateCommunitySchema.safeParse({ name: "新名前", description: "新説明" }).success).toBe(true);
  });

  it("空オブジェクトでも受け入れる（何も変更しない）", () => {
    expect(UpdateCommunitySchema.safeParse({}).success).toBe(true);
  });

  it("slug フィールドは含まれない（slug は不変）", () => {
    const result = UpdateCommunitySchema.parse({ name: "名前", slug: "new-slug" });
    expect(result).not.toHaveProperty("slug");
  });

  it("空文字の name は拒否する", () => {
    expect(UpdateCommunitySchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("空文字の description は拒否する", () => {
    expect(UpdateCommunitySchema.safeParse({ description: "" }).success).toBe(false);
  });

  it(`name が ${COMMUNITY_NAME_MAX_LENGTH} 文字を超えると拒否する`, () => {
    const longName = "a".repeat(COMMUNITY_NAME_MAX_LENGTH + 1);
    expect(UpdateCommunitySchema.safeParse({ name: longName }).success).toBe(false);
  });

  it(`description が ${COMMUNITY_DESCRIPTION_MAX_LENGTH} 文字を超えると拒否する`, () => {
    const longDesc = "a".repeat(COMMUNITY_DESCRIPTION_MAX_LENGTH + 1);
    expect(UpdateCommunitySchema.safeParse({ description: longDesc }).success).toBe(false);
  });

  it("generationInstruction を省略できる（optional）", () => {
    expect(UpdateCommunitySchema.safeParse({ name: "名前" }).success).toBe(true);
  });

  it("generationInstruction を指定できる", () => {
    expect(
      UpdateCommunitySchema.safeParse({ generationInstruction: "脱さん付け指示" }).success,
    ).toBe(true);
  });

  it(`generationInstruction が ${COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH} 文字を超えると拒否する（#91）`, () => {
    const longInstr = "a".repeat(COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH + 1);
    expect(
      UpdateCommunitySchema.safeParse({ generationInstruction: longInstr }).success,
    ).toBe(false);
  });
});

describe("CommunitySchema / AdminCommunitySchema のフィールド分離（#488）", () => {
  const basePublic = {
    id: "c1",
    slug: "tech",
    name: "Tech",
    description: "公開概要",
    created_at: new Date("2026-01-01"),
  };

  it("公開 CommunitySchema は generationInstruction を含まない", () => {
    const result = CommunitySchema.parse({ ...basePublic, generationInstruction: "秘密の指示" });
    expect(result).not.toHaveProperty("generationInstruction");
  });

  it("AdminCommunitySchema は generationInstruction を含む", () => {
    const result = AdminCommunitySchema.parse({ ...basePublic, generationInstruction: "秘密の指示" });
    expect(result).toHaveProperty("generationInstruction", "秘密の指示");
  });

  it("AdminCommunitySchema の generationInstruction は省略可能", () => {
    const result = AdminCommunitySchema.safeParse(basePublic);
    expect(result.success).toBe(true);
  });

  it(`AdminCommunitySchema の generationInstruction が ${COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH} 文字を超えると拒否する（#91）`, () => {
    const longInstr = "a".repeat(COMMUNITY_GENERATION_INSTRUCTION_MAX_LENGTH + 1);
    expect(
      AdminCommunitySchema.safeParse({ ...basePublic, generationInstruction: longInstr }).success,
    ).toBe(false);
  });
});
