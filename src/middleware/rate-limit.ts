import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types/app.ts";
import { checkLimits } from "../db/limits.ts";
import { makeError } from "../utils/errors.ts";

const rateLimitMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  const result = checkLimits(user.id);

  if (!result.allowed) {
    return c.json(
      makeError(
        `Rate limit exceeded: ${result.reason} (limit: ${result.limit}, used: ${result.used})`,
        "rate_limit_exceeded",
        429,
      ),
      429,
    );
  }

  await next();
});

export { rateLimitMiddleware };
