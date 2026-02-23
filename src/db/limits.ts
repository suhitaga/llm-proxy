import { db } from "./connection.ts";
import { getTokensUsedInWindow, getLifetimeTokens } from "./usage.ts";
import type { RateLimitRow, SetLimitsRequest, LimitCheckResult } from "../types/db.ts";

const DEFAULT_PRIORITY = 5;

const stmts = {
  upsert: () =>
    db.prepare<void, [string, number | null, number | null, number | null, number]>(
      `INSERT INTO rate_limits (user_id, tokens_per_minute, tokens_per_day, tokens_lifetime, priority)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         tokens_per_minute = excluded.tokens_per_minute,
         tokens_per_day = excluded.tokens_per_day,
         tokens_lifetime = excluded.tokens_lifetime,
         priority = excluded.priority,
         updated_at = datetime('now')`,
    ),
  select: () =>
    db.prepare<RateLimitRow, [string]>(
      "SELECT user_id, tokens_per_minute, tokens_per_day, tokens_lifetime, priority, updated_at FROM rate_limits WHERE user_id = ?",
    ),
  windowTime: () =>
    db.prepare<{ iso: string }, [string]>(
      "SELECT datetime('now', ?) as iso",
    ),
};

const setLimits = (req: SetLimitsRequest): void => {
  stmts.upsert().run(
    req.user_id,
    req.tokens_per_minute ?? null,
    req.tokens_per_day ?? null,
    req.tokens_lifetime ?? null,
    req.priority ?? DEFAULT_PRIORITY,
  );
};

const getLimits = (userId: string): RateLimitRow | null => {
  return stmts.select().get(userId) ?? null;
};

const getUserPriority = (userId: string): number => {
  const limits = getLimits(userId);
  return limits?.priority ?? DEFAULT_PRIORITY;
};

const getWindowStart = (offset: string): string => {
  const row = stmts.windowTime().get(offset);
  return row?.iso ?? new Date().toISOString();
};

const checkLimits = (userId: string): LimitCheckResult => {
  const limits = getLimits(userId);
  if (!limits) return { allowed: true };

  // cheapest check first, most likely to trip
  if (limits.tokens_per_minute !== null) {
    const since = getWindowStart("-1 minute");
    const used = getTokensUsedInWindow(userId, since);
    if (used >= limits.tokens_per_minute) {
      return { allowed: false, reason: "tokens_per_minute", limit: limits.tokens_per_minute, used };
    }
  }

  if (limits.tokens_per_day !== null) {
    const since = getWindowStart("-1 day");
    const used = getTokensUsedInWindow(userId, since);
    if (used >= limits.tokens_per_day) {
      return { allowed: false, reason: "tokens_per_day", limit: limits.tokens_per_day, used };
    }
  }

  if (limits.tokens_lifetime !== null) {
    const used = getLifetimeTokens(userId);
    if (used >= limits.tokens_lifetime) {
      return { allowed: false, reason: "tokens_lifetime", limit: limits.tokens_lifetime, used };
    }
  }

  return { allowed: true };
};

export { setLimits, getLimits, getUserPriority, checkLimits, DEFAULT_PRIORITY };
