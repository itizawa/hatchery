// XOR ビット演算で長さが等しい文字列を定数時間で比較する
function safeEqual({ a, b }: { a: string; b: string }): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export interface BasicAuthCredentials {
  user: string;
  password: string;
}

export function parseBasicAuth(authHeader: string | null): BasicAuthCredentials | null {
  if (!authHeader || !authHeader.startsWith("Basic ")) return null;
  try {
    const decoded = atob(authHeader.slice(6));
    const colonIdx = decoded.indexOf(":");
    if (colonIdx < 0) return null;
    return {
      user: decoded.slice(0, colonIdx),
      password: decoded.slice(colonIdx + 1),
    };
  } catch {
    return null;
  }
}

export function validateBasicAuth({
  authHeader,
  expectedUser,
  expectedPassword,
}: {
  authHeader: string | null | undefined;
  expectedUser: string;
  expectedPassword: string;
}): boolean {
  const credentials = parseBasicAuth(authHeader ?? null);
  if (!credentials) return false;
  // 両方を先に評価して && 短絡評価によるタイミング差を防ぐ
  const userOk = safeEqual({ a: credentials.user, b: expectedUser });
  const passOk = safeEqual({ a: credentials.password, b: expectedPassword });
  return userOk && passOk;
}
