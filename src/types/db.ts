// rows as they come back from SQLite

type UserRow = {
  id: string;
  name: string;
  api_key: string;
  created_at: string;
};

type UsageRow = {
  id: string;
  user_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  created_at: string;
};

type RateLimitRow = {
  user_id: string;
  tokens_per_minute: number | null;
  tokens_per_day: number | null;
  tokens_lifetime: number | null;
  priority: number;
  updated_at: string;
};

// API payloads

type CreateUserRequest = {
  name: string;
};

type CreateUserResponse = {
  id: string;
  name: string;
  api_key: string;
};

type SetLimitsRequest = {
  user_id: string;
  tokens_per_minute?: number | null;
  tokens_per_day?: number | null;
  tokens_lifetime?: number | null;
  priority?: number;
};

type LimitsResponse = {
  user_id: string;
  tokens_per_minute: number | null;
  tokens_per_day: number | null;
  tokens_lifetime: number | null;
  priority: number;
};

type UsageByModel = {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type UsageResponse = {
  user_id: string;
  usage: UsageByModel[];
};

// what checkLimits() returns

type LimitViolationReason = "tokens_per_minute" | "tokens_per_day" | "tokens_lifetime";

type LimitCheckResult =
  | { allowed: true }
  | { allowed: false; reason: LimitViolationReason; limit: number; used: number };

export type {
  UserRow,
  UsageRow,
  RateLimitRow,
  CreateUserRequest,
  CreateUserResponse,
  SetLimitsRequest,
  LimitsResponse,
  UsageByModel,
  UsageResponse,
  LimitViolationReason,
  LimitCheckResult,
};
