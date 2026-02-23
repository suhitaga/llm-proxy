import { Hono } from "hono";
import type { AppEnv } from "../types/app.ts";
import { getUsageByUser } from "../db/usage.ts";
import type { UsageResponse } from "../types/db.ts";

const usage = new Hono<AppEnv>();

usage.get("/v1/usage", (c) => {
  const user = c.get("user");
  const records = getUsageByUser(user.id);

  const response: UsageResponse = {
    user_id: user.id,
    usage: records,
  };

  return c.json(response, 200);
});

export { usage };
