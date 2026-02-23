import OpenAI from "openai";
import { BASE_URL, createTestUser, assert } from "./helpers.ts";

const main = async () => {
  console.log("=== SDK Streaming Chat Completion Test ===\n");

  const user = await createTestUser("sdk-streaming-test");
  console.log(`Created User: ${user.id}`);

  const client = new OpenAI({
    baseURL: `${BASE_URL}/v1`,
    apiKey: user.api_key,
  });

  console.log("1. Streaming Chat Completion");
  const stream = await client.chat.completions.create({
    model: "llama3.2",
    messages: [
      { role: "user", content: "Count from 1 to 5, separated by commas." },
    ],
    temperature: 0.1,
    max_tokens: 30,
    stream: true,
  });

  const chunks: string[] = [];
  let chunkCount = 0;

  for await (const chunk of stream) {
    chunkCount++;
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      chunks.push(content);
    }
  }

  const fullContent = chunks.join("");
  console.log(`  Received ${chunkCount} chunks`);
  console.log(`  Content: "${fullContent}"`);

  assert(chunkCount > 1, `Multiple chunks received (${chunkCount})`);
  assert(fullContent.length > 0, "Assembled content is non-empty");

  // Wait a moment for the fire-and-forget usage recording
  await new Promise((r) => setTimeout(r, 500));

  // Verify usage was tracked for streaming
  console.log("\n2. Usage Tracking After Streaming");
  const usageRes = await fetch(`${BASE_URL}/v1/usage`, {
    headers: { Authorization: `Bearer ${user.api_key}` },
  });
  const usageData = await usageRes.json() as { usage: { model: string; total_tokens: number }[] };

  assert(usageData.usage.length > 0, "Usage has records after streaming");
  assert(usageData.usage[0].total_tokens > 0, `Tokens recorded: ${usageData.usage[0].total_tokens}`);

  console.log("\nAll Tests Passed!");
};

main().catch((err) => {
  console.error("Test Failed:", err);
  process.exit(1);
});
