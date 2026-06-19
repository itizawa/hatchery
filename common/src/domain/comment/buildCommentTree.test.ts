import { describe, expect, it } from "vitest";

import { buildCommentTree, type FlatComment, type CommentTreeNode } from "./buildCommentTree.js";

describe("buildCommentTree", () => {
  const makeComment = (overrides: Partial<FlatComment> & { id: string }): FlatComment => ({
    id: overrides.id,
    parent_comment_id: overrides.parent_comment_id ?? null,
  });

  it("空配列を渡すと空配列を返す", () => {
    const result = buildCommentTree([]);
    expect(result).toEqual([]);
  });

  it("全コメントが parent_comment_id=null なら全トップレベルになる", () => {
    const comments = [
      makeComment({ id: "c1" }),
      makeComment({ id: "c2" }),
      makeComment({ id: "c3" }),
    ];
    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(3);
    expect(tree.map((n) => n.id)).toEqual(["c1", "c2", "c3"]);
    expect(tree.every((n) => n.children.length === 0)).toBe(true);
  });

  it("子コメントが親コメントの children に入る", () => {
    const comments = [
      makeComment({ id: "c1" }),
      makeComment({ id: "c2", parent_comment_id: "c1" }),
    ];
    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("c1");
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.id).toBe("c2");
  });

  it("多段ネストを正しく構築する", () => {
    const comments = [
      makeComment({ id: "c1" }),
      makeComment({ id: "c2", parent_comment_id: "c1" }),
      makeComment({ id: "c3", parent_comment_id: "c2" }),
    ];
    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("c1");
    expect(tree[0]?.children[0]?.id).toBe("c2");
    expect(tree[0]?.children[0]?.children[0]?.id).toBe("c3");
  });

  it("孤児コメント（存在しない親を参照）はトップレベルにフォールバックする", () => {
    const comments = [
      makeComment({ id: "c1" }),
      makeComment({ id: "c2", parent_comment_id: "nonexistent" }),
    ];
    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(2);
    expect(tree.map((n) => n.id)).toContain("c1");
    expect(tree.map((n) => n.id)).toContain("c2");
    expect(tree.find((n) => n.id === "c2")?.children).toHaveLength(0);
  });

  it("自己参照コメントはトップレベルにフォールバックする", () => {
    const comments = [
      makeComment({ id: "c1" }),
      makeComment({ id: "c2", parent_comment_id: "c2" }), // 自己参照
    ];
    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(2);
    expect(tree.find((n) => n.id === "c2")?.children).toHaveLength(0);
  });

  it("循環参照があっても無限ループしない", () => {
    // c1 -> c2 -> c1 という循環
    // この場合、先に登場した c1 が c2 の親と定義されるため
    // c2 は c1 の子として配置され、c1 の parent_comment_id=c2 は循環として検出される
    const comments = [
      makeComment({ id: "c1", parent_comment_id: "c2" }),
      makeComment({ id: "c2", parent_comment_id: "c1" }),
    ];
    // タイムアウトせずに返ること（無限ループしないこと）
    expect(() => buildCommentTree(comments)).not.toThrow();
    const tree = buildCommentTree(comments);
    // 両方がトップレベルか、一方が他方の子になるか（実装依存）
    // とにかく有限個のノードを返すことを確認
    const countNodes = (nodes: CommentTreeNode[]): number =>
      // eslint-disable-next-line max-params
      nodes.reduce((acc, n) => acc + 1 + countNodes(n.children), 0);
    expect(countNodes(tree)).toBe(2);
  });

  it("複数の子コメントが正しく親の children に入る", () => {
    const comments = [
      makeComment({ id: "c1" }),
      makeComment({ id: "c2", parent_comment_id: "c1" }),
      makeComment({ id: "c3", parent_comment_id: "c1" }),
      makeComment({ id: "c4", parent_comment_id: "c1" }),
    ];
    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children).toHaveLength(3);
  });

  it("複数のトップレベルそれぞれに子がいるケース", () => {
    const comments = [
      makeComment({ id: "c1" }),
      makeComment({ id: "c2" }),
      makeComment({ id: "c3", parent_comment_id: "c1" }),
      makeComment({ id: "c4", parent_comment_id: "c2" }),
    ];
    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(2);
    expect(tree.find((n) => n.id === "c1")?.children[0]?.id).toBe("c3");
    expect(tree.find((n) => n.id === "c2")?.children[0]?.id).toBe("c4");
  });

  it("ツリーノードの depth が正しく設定される", () => {
    const comments = [
      makeComment({ id: "c1" }),
      makeComment({ id: "c2", parent_comment_id: "c1" }),
      makeComment({ id: "c3", parent_comment_id: "c2" }),
    ];
    const tree = buildCommentTree(comments);
    expect(tree[0]?.depth).toBe(0);
    expect(tree[0]?.children[0]?.depth).toBe(1);
    expect(tree[0]?.children[0]?.children[0]?.depth).toBe(2);
  });
});
