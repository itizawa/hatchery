/**
 * コメントのツリー構築（#520）。
 * フラットなコメント配列（各要素が id / parent_comment_id を持つ）から
 * 階層ツリーへ変換する純粋関数。
 *
 * 規則:
 * - parent_comment_id が null のコメントはトップレベル。
 * - 孤児（存在しない親を参照）はトップレベルにフォールバック。
 * - 自己参照（parent_comment_id === id）はトップレベルにフォールバック。
 * - 循環参照は先に登場した側の parent_comment_id を無効（孤児扱い）として処理し、
 *   無限ループを防ぐ。
 */

/** buildCommentTree に渡すフラットコメントの最小インターフェース。 */
export interface FlatComment {
  id: string;
  parent_comment_id: string | null;
}

/** ツリーノード（FlatComment を拡張）。 */
export interface CommentTreeNode extends FlatComment {
  depth: number;
  children: CommentTreeNode[];
}

/**
 * フラットなコメント配列を階層ツリーに変換する。
 * 入力の順序（配列の並び）はトップレベルの並び順・兄弟の並び順に反映される。
 *
 * @param comments フラットなコメント配列（id / parent_comment_id を持つ）
 * @returns ルートノードの配列（各ノードが children を持つ）
 */
export function buildCommentTree(comments: readonly FlatComment[]): CommentTreeNode[] {
  if (comments.length === 0) return [];

  const idSet = new Set(comments.map((c) => c.id));

  // 循環参照検出: 有向グラフで祖先チェーンを辿り、祖先に自分が現れたら孤児扱いにする。
  // parent_comment_id を実際に有効な参照にするかどうかを決定するために、
  // 各コメントの「有効な parent」を事前計算する。
  const effectiveParent = new Map<string, string | null>();

  for (const comment of comments) {
    if (comment.parent_comment_id === null || !idSet.has(comment.parent_comment_id)) {
      // null / 存在しない親 → トップレベル
      effectiveParent.set(comment.id, null);
      continue;
    }
    if (comment.parent_comment_id === comment.id) {
      // 自己参照 → トップレベル
      effectiveParent.set(comment.id, null);
      continue;
    }
    // 循環参照チェック: parent を辿っていって自分自身に到達しないか確認。
    // visited は「チェック中に通ったノード id」のセット。
    const visited = new Set<string>();
    let current: string | null = comment.parent_comment_id;
    let hasCycle = false;
    while (current !== null) {
      if (current === comment.id) {
        hasCycle = true;
        break;
      }
      if (visited.has(current)) {
        // 別の循環（すでに確認済みの循環に合流）→ この経路には自分はいない
        break;
      }
      visited.add(current);
      // まだ effectiveParent が計算されていない場合は raw の parent_comment_id を参照
      const nextRaw = comments.find((c) => c.id === current)?.parent_comment_id ?? null;
      const nextEffective = effectiveParent.has(current)
        ? effectiveParent.get(current) ?? null
        : nextRaw;
      current = nextEffective;
    }
    effectiveParent.set(comment.id, hasCycle ? null : comment.parent_comment_id);
  }

  // ノードマップを作成（id → CommentTreeNode）
  const nodeMap = new Map<string, CommentTreeNode>();
  for (const comment of comments) {
    nodeMap.set(comment.id, {
      id: comment.id,
      parent_comment_id: comment.parent_comment_id,
      depth: 0,
      children: [],
    });
  }

  const roots: CommentTreeNode[] = [];

  for (const comment of comments) {
    const node = nodeMap.get(comment.id)!;
    const parentId = effectiveParent.get(comment.id) ?? null;
    if (parentId === null) {
      roots.push(node);
    } else {
      const parentNode = nodeMap.get(parentId);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // フォールバック（ここには通常来ない）
        roots.push(node);
      }
    }
  }

  // depth を設定（ルートから BFS で計算）
  const queue: Array<{ node: CommentTreeNode; depth: number }> = roots.map((n) => ({
    node: n,
    depth: 0,
  }));
  while (queue.length > 0) {
    const item = queue.shift()!;
    item.node.depth = item.depth;
    for (const child of item.node.children) {
      queue.push({ node: child, depth: item.depth + 1 });
    }
  }

  return roots;
}
