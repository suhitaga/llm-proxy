import { Hono } from "hono";
import { createUser } from "../db/users.ts";
import { setLimits, getLimits } from "../db/limits.ts";
import { queue } from "./chat.ts";
import { makeError } from "../utils/errors.ts";
import type { CreateUserRequest, SetLimitsRequest, LimitsResponse } from "../types/db.ts";

const admin = new Hono();

admin.post("/admin/users", async (c) => {
  const body = await c.req.json<CreateUserRequest>();

  if (!body.name?.trim()) {
    return c.json(makeError("name is required", "invalid_request", 400), 400);
  }

  const user = createUser(body.name.trim());
  return c.json(user, 201);
});

admin.post("/admin/limits", async (c) => {
  const body = await c.req.json<SetLimitsRequest>();

  if (!body.user_id) {
    return c.json(makeError("user_id is required", "invalid_request", 400), 400);
  }

  if (body.priority !== undefined && (body.priority < 1 || body.priority > 10)) {
    return c.json(makeError("priority must be between 1 and 10", "invalid_request", 400), 400);
  }

  setLimits(body);

  const saved = getLimits(body.user_id);
  if (!saved) {
    return c.json(makeError("Failed to save limits", "internal_error", 500), 500);
  }

  const response: LimitsResponse = {
    user_id: saved.user_id,
    tokens_per_minute: saved.tokens_per_minute,
    tokens_per_day: saved.tokens_per_day,
    tokens_lifetime: saved.tokens_lifetime,
    priority: saved.priority,
  };

  return c.json(response, 200);
});

admin.get("/admin/limits/:userId", (c) => {
  const userId = c.req.param("userId");
  const limits = getLimits(userId);

  if (!limits) {
    return c.json(makeError("No limits configured for this user", "invalid_request", 404), 404);
  }

  const response: LimitsResponse = {
    user_id: limits.user_id,
    tokens_per_minute: limits.tokens_per_minute,
    tokens_per_day: limits.tokens_per_day,
    tokens_lifetime: limits.tokens_lifetime,
    priority: limits.priority,
  };

  return c.json(response, 200);
});

admin.get("/admin/queue", (c) => {
  return c.json(queue.getStatus(), 200);
});

export { admin };
