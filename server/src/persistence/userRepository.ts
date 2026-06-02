import bcrypt from "bcrypt";

export interface User {
  id: string;
  displayName: string;
  passwordHash: string;
  /** 紐づく Employee の id（#49）。未紐づけなら null。 */
  employeeId: string | null;
  /** プロフィール画像 URL（#51）。未設定なら null。 */
  avatarUrl: string | null;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  /** #51: displayName と avatarUrl を更新する。 */
  updateProfile(id: string, data: { displayName: string; avatarUrl?: string }): Promise<User>;
}

/** インメモリ実装（テスト用）。 */
export class InMemoryUserRepository implements UserRepository {
  private users: User[] = [];

  constructor(users: User[] = []) {
    this.users = users;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async updateProfile(id: string, data: { displayName: string; avatarUrl?: string }): Promise<User> {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error(`User not found: ${id}`);
    user.displayName = data.displayName;
    user.avatarUrl = data.avatarUrl ?? user.avatarUrl;
    return user;
  }

  /**
   * テスト用ユーザー（testuser / testpass）を持つインスタンスを生成する。
   * employeeId を渡すと紐づく Employee の id として設定する（#49。既定は未紐づけ＝null）。
   */
  static async createWithTestUser(
    employeeId: string | null = null,
  ): Promise<InMemoryUserRepository> {
    const passwordHash = await bcrypt.hash("testpass", 10);
    return new InMemoryUserRepository([
      { id: "testuser", displayName: "Test User", passwordHash, employeeId, avatarUrl: null },
    ]);
  }
}
