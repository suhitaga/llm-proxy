import { db } from "./connection.ts";
import type { UserRow, CreateUserResponse } from "../types/db.ts";

const stmts = {
  insert: () =>
    db.prepare<void, [string, string, string]>(
      "INSERT INTO users (id, name, api_key) VALUES (?, ?, ?)",
    ),
  selectByApiKey: () =>
    db.prepare<UserRow, [string]>(
      "SELECT id, name, api_key, created_at FROM users WHERE api_key = ?",
    ),
};

const createUser = (name: string): CreateUserResponse => {
  const id = crypto.randomUUID();
  const apiKey = `sk-${crypto.randomUUID()}`;

  stmts.insert().run(id, name, apiKey);

  return { id, name, api_key: apiKey };
};

const findUserByApiKey = (apiKey: string): UserRow | null => {
  return stmts.selectByApiKey().get(apiKey) ?? null;
};

export { createUser, findUserByApiKey };
