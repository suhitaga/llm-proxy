import type { UsageStats } from "../types/openai.ts";

type StreamInterceptResult = {
  readable: ReadableStream<Uint8Array>;
  usagePromise: Promise<UsageStats | null>;
};

// Wraps an SSE stream so we can extract usage data from the final chunk
// without adding any latency for the client.
const interceptStream = (upstream: ReadableStream<Uint8Array>): StreamInterceptResult => {
  let resolveUsage: (usage: UsageStats | null) => void;
  const usagePromise = new Promise<UsageStats | null>((resolve) => {
    resolveUsage = resolve;
  });

  const decoder = new TextDecoder();
  let buffer = "";
  let capturedUsage: UsageStats | null = null;

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      // send bytes to the client first, parse after
      controller.enqueue(chunk);

      buffer += decoder.decode(chunk, { stream: true });

      // SSE events are separated by \n\n, but might span multiple chunks
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const trimmed = event.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") continue;

        try {
          const parsed = JSON.parse(payload) as Record<string, unknown>;
          if (parsed.usage && typeof parsed.usage === "object") {
            const u = parsed.usage as Record<string, number>;
            capturedUsage = {
              prompt_tokens: u.prompt_tokens,
              completion_tokens: u.completion_tokens,
              total_tokens: u.total_tokens,
            };
          }
        } catch {
          // bad JSON in a chunk, just skip it
        }
      }
    },
    flush() {
      resolveUsage(capturedUsage);
    },
  });

  const readable = upstream.pipeThrough(transform);
  return { readable, usagePromise };
};

export { interceptStream };
export type { StreamInterceptResult };
