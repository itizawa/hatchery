import type { UserRole } from "@hatchery/common";

// #455: Google-only auth へ移行。loginId・passwordHash を廃止し email・googleId を必須化。
export interface User {
  id: string;
  email: string;
  googleId: string;
  displayName: string;
  role: UserRole;
  avatarUrl: string | null;
}

/** googleId 重複時にスローされるドメインエラー（#455）。 */
export class GoogleIdAlreadyExistsError extends Error {
  constructor(googleId: string) {
    super(`Google id already exists: ${googleId}`);
    this.name = "GoogleIdAlreadyExistsError";
  }
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  updateProfile(id: string, data: { displayName: string; avatarUrl?: string }): Promise<User>;
  create(input: { email: string; googleId: string; displayName: string }): Promise<User>;
}

export function createInMemoryUserRepository(initialUsers: User[] = []): UserRepository {
  const users: User[] = initialUsers;

  return {
    findById(id: string): Promise<User | null> {
      return Promise.resolve(users.find((u) => u.id === id) ?? null);
    },

    findByGoogleId(googleId: string): Promise<User | null> {
      return Promise.resolve(users.find((u) => u.googleId === googleId) ?? null);
    },

    updateProfile(id: string, data: { displayName: string; avatarUrl?: string }): Promise<User> {
      const user = users.find((u) => u.id === id);
      if (!user) throw new Error(`User not found: ${id}`);
      user.displayName = data.displayName;
      user.avatarUrl = data.avatarUrl ?? user.avatarUrl;
      return Promise.resolve(user);
    },

    create(input: { email: string; googleId: string; displayName: string }): Promise<User> {
      if (users.some((u) => u.googleId === input.googleId)) {
        throw new GoogleIdAlreadyExistsError(input.googleId);
      }
      const user: User = {
        id: crypto.randomUUID(),
        email: input.email,
        googleId: input.googleId,
        displayName: input.displayName,
        role: "member",
        avatarUrl: null,
      };
      users.push(user);
      return Promise.resolve({ ...user });
    },
  };
}

/** テスト用の dev ユーザーを持つインメモリ UserRepository を生成する。 */
export function createTestUserRepository(role: UserRole = "admin"): UserRepository {
  return createInMemoryUserRepository([
    {
      id: "dev-user-1",
      email: "dev@hatchery.local",
      googleId: "dev-google-id",
      displayName: "claude-dev",
      role,
      avatarUrl: null,
    },
  ]);
}
