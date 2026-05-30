import bcrypt from "bcrypt";

export interface User {
  id: string;
  displayName: string;
  passwordHash: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
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

  /** テスト用ユーザー（testuser / testpass）を持つインスタンスを生成する。 */
  static async createWithTestUser(): Promise<InMemoryUserRepository> {
    const passwordHash = await bcrypt.hash("testpass", 10);
    return new InMemoryUserRepository([
      { id: "testuser", displayName: "Test User", passwordHash },
    ]);
  }
}
