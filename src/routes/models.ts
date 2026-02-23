import { Hono } from "hono";
import type { AppEnv } from "../types/app.ts";
import { forwardRequest } from "../proxy/forward.ts";
import { makeError } from "../utils/errors.ts";
import type { ModelListResponse } from "../types/openai.ts";

const models = new Hono<AppEnv>();

models.get("/v1/models", async (c) => {
  try {
    const result = await forwardRequest({
      method: "GET",
      path: "/v1/models",
    });

    if (result.kind === "stream") {
      return c.json(
        makeError("Unexpected stream response", "upstream_error", 502),
        502,
      );
    }

    return c.json(result.data as ModelListResponse, result.status as 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json(makeError(message, "upstream_error", 502), 502);
  }
});

export { models };
