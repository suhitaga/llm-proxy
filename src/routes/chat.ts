import { Hono } from "hono";
import type { AppEnv } from "../types/app.ts";
import { forwardRequest } from "../proxy/forward.ts";
import { interceptStream } from "../proxy/stream-interceptor.ts";
import { recordUsage } from "../db/usage.ts";
import { getUserPriority } from "../db/limits.ts";
import { RequestQueue, QueueFullError } from "../queue/request-queue.ts";
import { makeError } from "../utils/errors.ts";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from "../types/openai.ts";
import type { ForwardResult } from "../proxy/forward.ts";

const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY ?? 2);
const MAX_QUEUE_DEPTH = Number(process.env.MAX_QUEUE_DEPTH ?? 50);

const queue = new RequestQueue(MAX_CONCURRENCY, MAX_QUEUE_DEPTH);

const chat = new Hono<AppEnv>();

chat.post("/v1/chat/completions", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<ChatCompletionRequest>();

  if (!body.model || !body.messages?.length) {
    return c.json(
      makeError("model and messages are required", "invalid_request", 400),
      400,
    );
  }

  const isStreaming = body.stream === true;

  // tell Ollama to include token counts in the final streaming chunk
  const forwardBody = isStreaming
    ? { ...body, stream_options: { include_usage: true } }
    : body;

  const priority = getUserPriority(user.id);

  // waits here if all Ollama slots are busy
  let enqueueResult;
  try {
    enqueueResult = await queue.enqueue<ForwardResult>(
      priority,
      () =>
        forwardRequest(
          {
            method: "POST",
            path: "/v1/chat/completions",
            body: forwardBody,
          },
          isStreaming,
        ),
    );
  } catch (err) {
    if (err instanceof QueueFullError) {
      return c.json(
        makeError(err.message, "rate_limit_exceeded", 503),
        503,
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json(makeError(message, "upstream_error", 502), 502);
  }

  const { result, release, meta } = enqueueResult;

  const queueHeaders: Record<string, string> = {};
  if (meta.queued) {
    queueHeaders["X-Queue-Position"] = String(meta.position);
  }

  try {
    if (result.kind === "stream") {
      const { readable, usagePromise } = interceptStream(result.body);

      // free the queue slot and record usage once the stream finishes
      usagePromise.then((usage) => {
        release();
        if (usage) {
          recordUsage(
            user.id,
            body.model,
            usage.prompt_tokens,
            usage.completion_tokens,
            usage.total_tokens,
          );
        }
      });

      return new Response(readable, {
        status: result.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...queueHeaders,
        },
      });
    }

    release();

    const data = result.data as ChatCompletionResponse;
    if (data.usage) {
      recordUsage(
        user.id,
        body.model,
        data.usage.prompt_tokens,
        data.usage.completion_tokens,
        data.usage.total_tokens,
      );
    }

    for (const [key, value] of Object.entries(queueHeaders)) {
      c.header(key, value);
    }

    return c.json(data, result.status as 200);
  } catch (err) {
    release();
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json(makeError(message, "upstream_error", 502), 502);
  }
});

export { chat, queue };
