import type { ProxyError } from "../types/openai.ts";

const makeError = (
  message: string,
  type: ProxyError["error"]["type"],
  code: number,
): ProxyError => ({
  error: { message, type, code },
});

export { makeError };
