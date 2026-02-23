import OpenAI from "openai";
import { BASE_URL, createTestUser, assert } from "./helpers.ts";

const fetchImageAsBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return `data:${contentType};base64,${base64}`;
};

const main = async () => {
  console.log("=== SDK Vision Test (moondream) ===\n");

  const user = await createTestUser("sdk-vision-test");
  console.log(`Created User: ${user.id}`);

  const client = new OpenAI({
    baseURL: `${BASE_URL}/v1`,
    apiKey: user.api_key,
  });

  // Fetch image from Lorem Picsum and convert to base64 data URL
  const imageUrl = "https://picsum.photos/seed/replit-test/200/300";
  console.log("1. Fetching Image From Lorem Picsum...");
  const dataUrl = await fetchImageAsBase64(imageUrl);
  console.log(`  Fetched and encoded (${(dataUrl.length / 1024).toFixed(0)}KB data URL)`);

  console.log("\n2. Vision Completion With Moondream");
  const response = await client.chat.completions.create({
    model: "moondream",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Describe what you see in this image in one sentence." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 100,
  });

  assert(response.choices.length > 0, "Response has choices");
  const content = response.choices[0].message.content;
  assert(content !== null && content.length > 0, "Response has content");
  console.log(`  Description: "${content}"`);

  assert(response.usage !== undefined, "Response has usage stats");
  console.log(`  Tokens: prompt=${response.usage!.prompt_tokens}, completion=${response.usage!.completion_tokens}`);

  // Verify usage tracking
  console.log("\n3. Usage Tracking For Vision Model");
  const usageRes = await fetch(`${BASE_URL}/v1/usage`, {
    headers: { Authorization: `Bearer ${user.api_key}` },
  });
  const usageData = await usageRes.json() as { usage: { model: string; total_tokens: number }[] };

  assert(usageData.usage.length > 0, "Usage has records");
  const moondreamUsage = usageData.usage.find((u: { model: string }) => u.model === "moondream");
  assert(moondreamUsage !== undefined, "Usage tracked for moondream model");

  console.log("\nAll Tests Passed!");
};

main().catch((err) => {
  console.error("Test Failed:", err);
  process.exit(1);
});
