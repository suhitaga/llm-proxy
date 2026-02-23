import { Hono } from "hono";
import type { AppEnv } from "./types/app.ts";
import { migrate } from "./db/schema.ts";
import { authMiddleware } from "./middleware/auth.ts";
import { rateLimitMiddleware } from "./middleware/rate-limit.ts";
import { admin } from "./routes/admin.ts";
import { chat } from "./routes/chat.ts";
import { models } from "./routes/models.ts";
import { usage } from "./routes/usage.ts";
import { OLLAMA_BASE_URL } from "./proxy/forward.ts";

migrate();

const app = new Hono<AppEnv>();

// admin routes are open, everything under /v1 needs auth
app.route("/", admin);
app.use("/v1/*", authMiddleware);
app.use("/v1/chat/completions", rateLimitMiddleware);

app.route("/", chat);
app.route("/", models);
app.route("/", usage);

const PORT = 8000;

console.log(`Proxy server listening on http://localhost:${PORT}`);
console.log(`Forwarding to Ollama at ${OLLAMA_BASE_URL}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
