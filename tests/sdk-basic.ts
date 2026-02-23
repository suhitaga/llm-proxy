import OpenAI from "openai";
import { BASE_URL, createTestUser, assert } from "./helpers.ts";

const main = async () => {
  console.log("=== SDK Basic Chat Completion Test ===\n");

  const user = await createTestUser("sdk-basic-test");
  console.log(`Created User: ${user.id}`);

  const client = new OpenAI({
    baseURL: `${BASE_URL}/v1`,
    apiKey: user.api_key,
  });

  // Basic chat completion
  console.log("\n1. Non-Streaming Chat Completion");
  const response = await client.chat.completions.create({
    model: "llama3.2",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "What is 2+2? Reply with just the number." },
    ],
    temperature: 0.1,
    max_tokens: 10,
  });

  assert(response.id !== undefined, "Response has an id");
  assert(response.choices.length > 0, "Response has choices");
  assert(response.choices[0].message.content !== null, "Response has content");
  assert(response.choices[0].finish_reason === "stop" || response.choices[0].finish_reason === "length", "Has valid finish_reason");
  assert(response.usage !== undefined, "Response has usage stats");
  assert(response.usage!.prompt_tokens > 0, `Prompt tokens: ${response.usage!.prompt_tokens}`);
  assert(response.usage!.completion_tokens > 0, `Completion tokens: ${response.usage!.completion_tokens}`);
  assert(response.usage!.total_tokens > 0, `Total tokens: ${response.usage!.total_tokens}`);

  console.log(`  Content: "${response.choices[0].message.content}"`);

  // Verify usage tracking
  console.log("\n2. Usage Tracking");
  const usageRes = await fetch(`${BASE_URL}/v1/usage`, {
    headers: { Authorization: `Bearer ${user.api_key}` },
  });
  const usageData = await usageRes.json() as { user_id: string; usage: { model: string; total_tokens: number }[] };

  assert(usageData.user_id === user.id, "Usage belongs to correct user");
  assert(usageData.usage.length > 0, "Usage has records");
  assert(usageData.usage[0].model === "llama3.2", "Usage tracked for correct model");
  assert(usageData.usage[0].total_tokens === response.usage!.total_tokens, "Usage matches response");

  console.log("\nAll Tests Passed!");
};

main().catch((err) => {
  console.error("Test Failed:", err);
  process.exit(1);
});
