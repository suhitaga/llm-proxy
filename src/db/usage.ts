import { db } from "./connection.ts";
import type { UsageByModel } from "../types/db.ts";

const stmts = {
  insert: () =>
    db.prepare<void, [string, string, string, number, number, number]>(
      `INSERT INTO usage_records (id, user_id, model, prompt_tokens, completion_tokens, total_tokens)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ),
  byUser: () =>
    db.prepare<UsageByModel, [string]>(
      `SELECT model,
              SUM(prompt_tokens) as prompt_tokens,
              SUM(completion_tokens) as completion_tokens,
              SUM(total_tokens) as total_tokens
       FROM usage_records WHERE user_id = ? GROUP BY model`,
    ),
  tokensSinceWindow: () =>
    db.prepare<{ total: number }, [string, string]>(
      `SELECT COALESCE(SUM(total_tokens), 0) as total
       FROM usage_records WHERE user_id = ? AND created_at >= ?`,
    ),
  lifetimeTokens: () =>
    db.prepare<{ total: number }, [string]>(
      `SELECT COALESCE(SUM(total_tokens), 0) as total
       FROM usage_records WHERE user_id = ?`,
    ),
};

const recordUsage = (
  userId: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
): void => {
  const id = crypto.randomUUID();
  stmts.insert().run(id, userId, model, promptTokens, completionTokens, totalTokens);
};

const getUsageByUser = (userId: string): UsageByModel[] => {
  return stmts.byUser().all(userId);
};

const getTokensUsedInWindow = (userId: string, sinceIso: string): number => {
  const row = stmts.tokensSinceWindow().get(userId, sinceIso);
  return row?.total ?? 0;
};

const getLifetimeTokens = (userId: string): number => {
  const row = stmts.lifetimeTokens().get(userId);
  return row?.total ?? 0;
};

export { recordUsage, getUsageByUser, getTokensUsedInWindow, getLifetimeTokens };
