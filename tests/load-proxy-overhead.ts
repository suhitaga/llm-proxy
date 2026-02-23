import { BASE_URL, createTestUser, assert } from "./helpers.ts";

const main = async () => {
  console.log("=== Load Test: Proxy Overhead ===\n");
  console.log("Testing raw proxy throughput with /v1/models (lightweight endpoint).\n");

  const user = await createTestUser("load-overhead-test");

  const TOTAL_REQUESTS = 1000;
  const CONCURRENCY = 100;

  const latencies: number[] = [];
  let successes = 0;
  let failures = 0;

  const makeRequest = async (): Promise<void> => {
    const start = performance.now();
    try {
      const res = await fetch(`${BASE_URL}/v1/models`, {
        headers: { Authorization: `Bearer ${user.api_key}` },
      });
      if (res.ok) {
        await res.json();
        successes++;
      } else {
        failures++;
      }
    } catch {
      failures++;
    }
    latencies.push(performance.now() - start);
  };

  // Run in batches of CONCURRENCY
  const startTime = performance.now();

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    const batch = Math.min(CONCURRENCY, TOTAL_REQUESTS - i);
    await Promise.all(Array.from({ length: batch }, () => makeRequest()));
  }

  const totalTime = performance.now() - startTime;

  // Calculate stats
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const rps = (TOTAL_REQUESTS / totalTime) * 1000;

  console.log(`Total requests:  ${TOTAL_REQUESTS}`);
  console.log(`Concurrency:     ${CONCURRENCY}`);
  console.log(`Total time:      ${totalTime.toFixed(0)}ms`);
  console.log(`Requests/sec:    ${rps.toFixed(0)}`);
  console.log(`Successes:       ${successes}`);
  console.log(`Failures:        ${failures}`);
  console.log(`\nLatency (ms):`);
  console.log(`  P50: ${p50.toFixed(1)}`);
  console.log(`  P95: ${p95.toFixed(1)}`);
  console.log(`  P99: ${p99.toFixed(1)}`);

  assert(failures === 0, "Zero failed requests");
  assert(rps > 100, `RPS > 100 (got ${rps.toFixed(0)})`);

  console.log("\nAll Tests Passed!");
};

main().catch((err) => {
  console.error("Test Failed:", err);
  process.exit(1);
});
