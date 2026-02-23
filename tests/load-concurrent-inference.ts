import { BASE_URL, createTestUser, assert } from "./helpers.ts";

const main = async () => {
  console.log("=== Load Test: Concurrent Inference ===\n");
  console.log("Testing proxy stability under concurrent LLM inference requests.\n");

  const user = await createTestUser("load-inference-test");

  const TOTAL_REQUESTS = 20;
  const CONCURRENCY = 10;

  const results: { status: number; latency: number; tokens: number }[] = [];
  let failures = 0;

  const makeRequest = async (i: number): Promise<void> => {
    const start = performance.now();
    try {
      const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3.2",
          messages: [{ role: "user", content: `Say the number ${i}` }],
          max_tokens: 5,
          temperature: 0,
        }),
      });

      const latency = performance.now() - start;

      if (res.ok) {
        const data = await res.json() as { usage: { total_tokens: number } };
        results.push({ status: res.status, latency, tokens: data.usage?.total_tokens ?? 0 });
      } else {
        failures++;
        results.push({ status: res.status, latency, tokens: 0 });
      }
    } catch {
      failures++;
      results.push({ status: 0, latency: performance.now() - start, tokens: 0 });
    }
  };

  const startTime = performance.now();

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    const batch = Math.min(CONCURRENCY, TOTAL_REQUESTS - i);
    await Promise.all(
      Array.from({ length: batch }, (_, j) => makeRequest(i + j)),
    );
  }

  const totalTime = performance.now() - startTime;

  // Stats
  const latencies = results.map((r) => r.latency).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const totalTokens = results.reduce((acc, r) => acc + r.tokens, 0);
  const successCount = results.filter((r) => r.status === 200).length;

  console.log(`Total requests:  ${TOTAL_REQUESTS}`);
  console.log(`Concurrency:     ${CONCURRENCY}`);
  console.log(`Total time:      ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`Successes:       ${successCount}/${TOTAL_REQUESTS}`);
  console.log(`Failures:        ${failures}`);
  console.log(`Total tokens:    ${totalTokens}`);
  console.log(`\nLatency:`);
  console.log(`  P50: ${(p50 / 1000).toFixed(1)}s`);
  console.log(`  P95: ${(p95 / 1000).toFixed(1)}s`);

  // Verify usage tracking captured all inference
  await new Promise((r) => setTimeout(r, 500));
  const usageRes = await fetch(`${BASE_URL}/v1/usage`, {
    headers: { Authorization: `Bearer ${user.api_key}` },
  });
  const usageData = await usageRes.json() as { usage: { total_tokens: number }[] };
  const trackedTokens = usageData.usage.reduce((acc: number, u: { total_tokens: number }) => acc + u.total_tokens, 0);

  console.log(`\nUsage Tracking:`);
  console.log(`  Response Tokens: ${totalTokens}`);
  console.log(`  Tracked Tokens:  ${trackedTokens}`);

  assert(successCount === TOTAL_REQUESTS, `All requests succeeded (${successCount}/${TOTAL_REQUESTS})`);
  assert(failures === 0, "Zero connection failures");
  assert(trackedTokens === totalTokens, "All tokens tracked in usage");

  console.log("\nAll Tests Passed!");
};

main().catch((err) => {
  console.error("Test Failed:", err);
  process.exit(1);
});
