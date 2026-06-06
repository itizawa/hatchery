import connectPgSimple from "connect-pg-simple";
import session from "express-session";
import pg from "pg";

/**
 * DATABASE_URL から connect-pg-simple の PostgreSQL セッションストアを生成する（#186）。
 * `session` テーブルは migration で事前に作成されていること。
 */
export function createPgSessionStore(databaseUrl: string): session.Store {
  const PgSession = connectPgSimple(session);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  return new PgSession({ pool, tableName: "session" });
}
