import { Database } from "bun:sqlite";

const DB_PATH = process.env.DB_PATH ?? "proxy.db";

const db = new Database(DB_PATH, { create: true });

// WAL lets reads proceed while writes are happening
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

export { db };
