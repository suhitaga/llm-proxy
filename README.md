# llm-proxy

OpenAI-compatible proxy that fronts a local Ollama instance. Auth, per-user usage tracking, rate limiting, and a priority request queue, all stored in SQLite.

Bun + Hono + TypeScript.

## Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Ollama](https://ollama.com) running locally with models pulled:

```bash
brew install ollama
brew services start ollama
ollama pull llama3.2
ollama pull moondream
```

## Getting started

```bash
bun install
bun run src/index.ts
```

Server runs on `http://localhost:8000`, proxies to Ollama at `127.0.0.1:11434`.

## How it works

`/v1/*` endpoints need a Bearer token. `/admin/*` endpoints are open.

Every completion (streaming and non-streaming) gets intercepted to record token usage per user per model. For streams, a `TransformStream` picks up the usage stats from the final SSE chunk without slowing anything down for the client.

Rate limits get checked before each completion. Three tiers: per-minute, per-day, and lifetime. Configurable per-user through the admin API.

There's a priority request queue in front of Ollama so it doesn't get overwhelmed. Only `MAX_CONCURRENCY` requests (default 2) hit Ollama at once, the rest wait in line ordered by priority. If the queue is full (`MAX_QUEUE_DEPTH`, default 50), you get a 503 right away rather than waiting forever.

## API

### Admin

Create a user, get back their API key:

```bash
curl -X POST localhost:8000/admin/users \
  -H "Content-Type: application/json" \
  -d '{"name": "alice"}'
```

Set rate limits and priority:

```bash
curl -X POST localhost:8000/admin/limits \
  -H "Content-Type: application/json" \
  -d '{"user_id": "...", "tokens_per_minute": 1000, "tokens_per_day": 50000, "tokens_lifetime": 1000000, "priority": 8}'
```

Limit fields can be `null` (unlimited) or left out. Priority goes from 1-10, defaults to 5. Higher means you get served first when the queue is backed up.

Check a user's limits:

```bash
curl localhost:8000/admin/limits/<user_id>
```

Check the request queue:

```bash
curl localhost:8000/admin/queue
```

### Chat completions

Same interface as the OpenAI API. Pass your API key as a Bearer token.

```bash
curl localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3.2", "messages": [{"role": "user", "content": "hello"}]}'
```

Streaming works too, add `"stream": true`.

Vision with moondream takes base64-encoded images in the standard OpenAI content parts format.

### Models

```bash
curl localhost:8000/v1/models -H "Authorization: Bearer sk-..."
```

### Usage

Token usage broken down by model:

```bash
curl localhost:8000/v1/usage -H "Authorization: Bearer sk-..."
```

## Using the OpenAI SDK

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8000/v1",
  apiKey: "sk-...",
});

const response = await client.chat.completions.create({
  model: "llama3.2",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What is 2+2?" },
  ],
  temperature: 0.7,
  max_tokens: 100,
});
```

## Architecture

```
src/
├── index.ts                     Entry point, middleware wiring
├── types/
│   ├── openai.ts                OpenAI-compatible request/response types
│   ├── app.ts                   Hono env type (typed middleware context)
│   └── db.ts                    Domain types, API payloads, limit check union
├── db/
│   ├── connection.ts            SQLite singleton (WAL mode for concurrency)
│   ├── schema.ts                Table migrations
│   ├── users.ts                 User CRUD
│   ├── usage.ts                 Usage recording + sliding window queries
│   └── limits.ts                Rate limit CRUD + 3-tier check + priority
├── middleware/
│   ├── auth.ts                  Bearer token -> user resolution
│   └── rate-limit.ts            Pre-request limit enforcement
├── proxy/
│   ├── forward.ts               HTTP forwarding to Ollama
│   └── stream-interceptor.ts    TransformStream for SSE usage capture
├── queue/
│   ├── priority-heap.ts         Generic binary min-heap
│   └── request-queue.ts         Bounded concurrency pool with priority ordering
├── routes/
│   ├── chat.ts                  POST /v1/chat/completions (queued)
│   ├── models.ts                GET /v1/models
│   ├── usage.ts                 GET /v1/usage
│   └── admin.ts                 User + limit + queue management
└── utils/
    └── errors.ts                Shared error builder
```

## Design decisions

**Stream interception**: The `TransformStream` in `stream-interceptor.ts` sends chunks to the client right away, then parses the SSE buffer on the side looking for usage data. We inject `stream_options: { include_usage: true }` into the upstream request so Ollama includes token counts in the final chunk. A Promise resolves when the stream ends and writes to SQLite. The client doesn't wait for any of that.

**Rate limiting**: Waterfall check before each request: per-minute, per-day, then lifetime (cheapest query first, most likely to fail first). Sliding windows use SQLite `datetime()` against an indexed `created_at` column. There's a small TOCTOU window where two concurrent requests could both pass the check, but that's a fine tradeoff vs the complexity of atomic counters here.

**SQLite WAL mode**: Lets reads happen while a write is in progress. Without this, auth lookups would block during usage recording under load.

**Request queue**: Binary heap gives O(log n) priority scheduling. Queue slots are held for the full inference duration. For streaming responses, the slot gets released when the stream finishes, not when the HTTP response starts. If the queue is full you get 503 (backpressure) rather than unbounded growth. Configurable with `MAX_CONCURRENCY` and `MAX_QUEUE_DEPTH` env vars.

## Tests

```bash
# start the server first
bun run src/index.ts

# individual tests
bun run tests/sdk-basic.ts
bun run tests/sdk-streaming.ts
bun run tests/sdk-vision.ts
bun run tests/load-proxy-overhead.ts
bun run tests/load-concurrent-inference.ts
bun run tests/queue.ts
```

| Test                        | What it covers                                                      |
| --------------------------- | ------------------------------------------------------------------- |
| `sdk-basic`                 | Non-streaming completion via OpenAI SDK, usage tracking             |
| `sdk-streaming`             | Streaming chunks via async iterator, usage captured from SSE        |
| `sdk-vision`                | Moondream + base64 Lorem Picsum image                               |
| `load-proxy-overhead`       | 1000 requests at 100 concurrency on /v1/models                      |
| `load-concurrent-inference` | 20 concurrent chat completions, token tracking verified             |
| `queue`                     | Priority ordering, backpressure (503), queue drain, slot management |
