import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types/app.ts";
import { findUserByApiKey } from "../db/users.ts";
import { makeError } from "../utils/errors.ts";

const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return c.json(
      makeError("Missing or invalid Authorization header", "auth_error", 401),
      401,
    );
  }

  const apiKey = header.slice(7);
  const row = findUserByApiKey(apiKey);

  if (!row) {
    return c.json(
      makeError("Invalid API key", "auth_error", 401),
      401,
    );
  }

  c.set("user", {
    id: row.id,
    name: row.name,
    apiKey: row.api_key,
    createdAt: row.created_at,
  });

  await next();
});

export { authMiddleware };
