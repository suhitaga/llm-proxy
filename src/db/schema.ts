import { db } from "./connection.ts";

const migrate = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      api_key    TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_records (
      id                TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL REFERENCES users(id),
      model             TEXT NOT NULL,
      prompt_tokens     INTEGER NOT NULL,
      completion_tokens INTEGER NOT NULL,
      total_tokens      INTEGER NOT NULL,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_user_model ON usage_records(user_id, model)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_user_created ON usage_records(user_id, created_at)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      user_id            TEXT PRIMARY KEY REFERENCES users(id),
      tokens_per_minute  INTEGER,
      tokens_per_day     INTEGER,
      tokens_lifetime    INTEGER,
      priority           INTEGER NOT NULL DEFAULT 5,
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

export { migrate };
