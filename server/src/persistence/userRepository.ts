import bcrypt from "bcrypt";
import type { UserRole } from "@hatchery/common";

export interface User {
  id: string;
  loginId: string;
  displayName: string;
  passwordHash: string;
  /** 権限ロール（#136）。 */
  role: UserRole;
  /** 紐づく Employee の id（#49）。未紐づけなら null。 */
  employeeId: string | null;
  /** プロフィール画像 URL（#51）。未設定なら null。 */
  avatarUrl: string | null;
}

/** loginId 重複時にスローされるドメインエラー（#185）。 */
export class LoginIdAlreadyExistsError extends Error {
  constructor(loginId: string) {
    super(`Login id already exists: ${loginId}`);
    this.name = "LoginIdAlreadyExistsError";
  }
}

/** @deprecated Use LoginIdAlreadyExistsError */
export class UserIdAlreadyExistsError extends LoginIdAlreadyExistsError {}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByLoginId(loginId: string): Promise<User | null>;
  /** #51: displayName と avatarUrl を更新する。 */
  updateProfile(id: string, data: { displayName: string; avatarUrl?: string }): Promise<User>;
  /** #132/#185: 新規ユーザーを作成する。loginId 重複時は LoginIdAlreadyExistsError をスロー。 */
  create(input: { loginId: string; displayName: string; passwordHash: string }): Promise<User>;
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

  async findByLoginId(loginId: string): Promise<User | null> {
    return this.users.find((u) => u.loginId === loginId) ?? null;
  }

  async updateProfile(id: string, data: { displayName: string; avatarUrl?: string }): Promise<User> {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error(`User not found: ${id}`);
    user.displayName = data.displayName;
    user.avatarUrl = data.avatarUrl ?? user.avatarUrl;
    return user;
  }

  async create(input: { loginId: string; displayName: string; passwordHash: string }): Promise<User> {
    if (this.users.some((u) => u.loginId === input.loginId)) {
      throw new LoginIdAlreadyExistsError(input.loginId);
    }
    const user: User = {
      id: input.loginId,
      loginId: input.loginId,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      role: "member",
      employeeId: null,
      avatarUrl: null,
    };
    this.users.push(user);
    return { ...user };
  }

  /**
   * テスト用ユーザー（testuser / testpass）を持つインスタンスを生成する。
   * employeeId を渡すと紐づく Employee の id として設定する（#49。既定は未紐づけ＝null）。
   * role を渡すと権限ロールを設定する（#136。既定は admin）。
   */
  static async createWithTestUser(
    employeeId: string | null = null,
    role: UserRole = "admin",
  ): Promise<InMemoryUserRepository> {
    const passwordHash = await bcrypt.hash("testpass", 10);
    return new InMemoryUserRepository([
      { id: "testuser", loginId: "testuser", displayName: "Test User", passwordHash, role, employeeId, avatarUrl: null },
    ]);
  }
}
