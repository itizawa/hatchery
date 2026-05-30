/**
 * Employee ↔ Channel の所属（多対多）の永続化境界（ポート）。
 * ユースケース / バッチはこのインターフェースにのみ依存し、実装（Prisma / InMemory）を注入する
 * （ADR-0004 の層分離 / ADR-0005）。
 */
export interface ChannelMembershipRepository {
  /** 所属を追加する。既に存在する場合は何もしない（冪等）。 */
  addMember(channelId: string, employeeId: string): Promise<void>;
  /** 所属を除外する。存在しない場合は何もしない。 */
  removeMember(channelId: string, employeeId: string): Promise<void>;
  /** チャンネルに所属する Employee id の一覧。 */
  listEmployeeIdsByChannel(channelId: string): Promise<string[]>;
  /** Employee が所属するチャンネル id の一覧（多対多の確認）。 */
  listChannelIdsByEmployee(employeeId: string): Promise<string[]>;
  /** チャンネル id → 所属 Employee id 群のマップ（定時バッチの発言候補に使う）。 */
  listMembershipByChannel(): Promise<Record<string, string[]>>;
}

interface Membership {
  channelId: string;
  employeeId: string;
}

/** DB 非依存のインメモリ実装。ユースケース / ルートのテストで注入する。 */
export class InMemoryChannelMembershipRepository implements ChannelMembershipRepository {
  private readonly memberships: Membership[] = [];

  addMember(channelId: string, employeeId: string): Promise<void> {
    const exists = this.memberships.some(
      (m) => m.channelId === channelId && m.employeeId === employeeId,
    );
    if (!exists) {
      this.memberships.push({ channelId, employeeId });
    }
    return Promise.resolve();
  }

  removeMember(channelId: string, employeeId: string): Promise<void> {
    const index = this.memberships.findIndex(
      (m) => m.channelId === channelId && m.employeeId === employeeId,
    );
    if (index !== -1) {
      this.memberships.splice(index, 1);
    }
    return Promise.resolve();
  }

  listEmployeeIdsByChannel(channelId: string): Promise<string[]> {
    return Promise.resolve(
      this.memberships.filter((m) => m.channelId === channelId).map((m) => m.employeeId),
    );
  }

  listChannelIdsByEmployee(employeeId: string): Promise<string[]> {
    return Promise.resolve(
      this.memberships.filter((m) => m.employeeId === employeeId).map((m) => m.channelId),
    );
  }

  listMembershipByChannel(): Promise<Record<string, string[]>> {
    const map: Record<string, string[]> = {};
    for (const m of this.memberships) {
      (map[m.channelId] ??= []).push(m.employeeId);
    }
    return Promise.resolve(map);
  }
}
