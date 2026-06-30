/** e2e テスト用ユーザー作成ヘルパー（Issue #897）。 */

const API_BASE = process.env.E2E_API_BASE_URL ?? "http://localhost:3001";

interface User {
  id: string;
  email: string;
  password: string;
  delete: () => Promise<void>;
}

export async function createUser(): Promise<User> {
  const id = `test-user-${Date.now()}`;
  const email = `${id}@e2e.test`;
  const password = "TestPassword123!";

  const res = await fetch(`${API_BASE}/api/test/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`createUser failed: ${res.status} ${await res.text()}`);
  const user = (await res.json()) as { id: string };
  return {
    id: user.id,
    email,
    password,
    delete: async () => {
      const del = await fetch(`${API_BASE}/api/test/users/${user.id}`, { method: "DELETE" });
      if (!del.ok) throw new Error(`deleteUser failed: ${del.status}`);
    },
  };
}
