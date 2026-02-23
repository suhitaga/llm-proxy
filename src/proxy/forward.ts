const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

type ForwardOptions = {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
};

type ForwardResult =
  | { kind: "json"; status: number; data: unknown }
  | { kind: "stream"; status: number; body: ReadableStream<Uint8Array> };

const forwardRequest = async (
  options: ForwardOptions,
  stream: boolean = false,
): Promise<ForwardResult> => {
  const url = `${OLLAMA_BASE_URL}${options.path}`;

  const response = await fetch(url, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (stream) {
    if (!response.body) {
      throw new Error("Expected stream body from upstream but got none");
    }
    return { kind: "stream", status: response.status, body: response.body };
  }

  const data: unknown = await response.json();
  return { kind: "json", status: response.status, data };
};

export { forwardRequest, OLLAMA_BASE_URL };
export type { ForwardOptions, ForwardResult };
