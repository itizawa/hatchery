import bcrypt from "bcrypt";
import type { UserRole } from "@hatchery/common";

export interface User {
  id: string;
  loginId: string;
  displayName: string;
  passwordHash: string;
  /** 権限ロール（#136）。 */
  role: UserRole;
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
export function createInMemoryUserRepository(initialUsers: User[] = []): UserRepository {
  const users: User[] = initialUsers;

  return {
    findById(id: string): Promise<User | null> {
      return Promise.resolve(users.find((u) => u.id === id) ?? null);
    },

    findByLoginId(loginId: string): Promise<User | null> {
      return Promise.resolve(users.find((u) => u.loginId === loginId) ?? null);
    },

    updateProfile(id: string, data: { displayName: string; avatarUrl?: string }): Promise<User> {
      const user = users.find((u) => u.id === id);
      if (!user) throw new Error(`User not found: ${id}`);
      user.displayName = data.displayName;
      user.avatarUrl = data.avatarUrl ?? user.avatarUrl;
      return Promise.resolve(user);
    },

    create(input: { loginId: string; displayName: string; passwordHash: string }): Promise<User> {
      if (users.some((u) => u.loginId === input.loginId)) {
        throw new LoginIdAlreadyExistsError(input.loginId);
      }
      const user: User = {
        id: input.loginId,
        loginId: input.loginId,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        role: "member",
        avatarUrl: null,
      };
      users.push(user);
      return Promise.resolve({ ...user });
    },
  };
}

/**
 * テスト用ユーザー（testuser / testpass）を持つインメモリ UserRepository を生成する。
 * role を渡すと権限ロールを設定する（#136。既定は admin）。
 */
export async function createTestUserRepository(
  role: UserRole = "admin",
): Promise<UserRepository> {
  const passwordHash = await bcrypt.hash("testpass", 10);
  return createInMemoryUserRepository([
    {
      id: "testuser",
      loginId: "testuser",
      displayName: "Test User",
      passwordHash,
      role,
      avatarUrl: null,
    },
  ]);
}
