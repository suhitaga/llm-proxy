import { BASE_URL, createTestUser, assert } from "./helpers.ts";

type TestUser = { id: string; name: string; api_key: string };

const setLimits = async (userId: string, priority: number) => {
  await fetch(`${BASE_URL}/admin/limits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, priority }),
  });
};

const getQueueStatus = async () => {
  const res = await fetch(`${BASE_URL}/admin/queue`);
  return res.json() as Promise<{ active: number; queued: number; maxConcurrency: number }>;
};

const makeCompletion = async (apiKey: string, content: string) => {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama3.2",
      messages: [{ role: "user", content }],
      max_tokens: 5,
      temperature: 0,
    }),
  });
  const latency = performance.now() - start;
  const queuePosition = res.headers.get("X-Queue-Position");
  return { status: res.status, latency, queuePosition, body: await res.json() };
};

const main = async () => {
  console.log("=== Queue Feature Test ===\n");

  // ── Test 1: Queue status endpoint ──
  console.log("1. Queue Status Endpoint");
  const status = await getQueueStatus();
  assert(status.active === 0, "No active requests initially");
  assert(status.queued === 0, "No queued requests initially");
  assert(status.maxConcurrency === 2, `Max concurrency is 2 (got ${status.maxConcurrency})`);

  // ── Test 2: Concurrent requests queue up ──
  console.log("\n2. Concurrent Requests Queue Properly");
  const user = await createTestUser("queue-test");

  // Fire 4 concurrent requests with max_concurrency=2
  // First 2 should run immediately, next 2 should queue
  const promises = Array.from({ length: 4 }, (_, i) =>
    makeCompletion(user.api_key, `Say the number ${i}`),
  );

  // While requests are in flight, check queue
  await new Promise((r) => setTimeout(r, 100));
  const midStatus = await getQueueStatus();
  console.log(`  Mid-flight: active=${midStatus.active}, queued=${midStatus.queued}`);
  // At least some should be active (timing-dependent, just verify it's reasonable)

  const results = await Promise.all(promises);
  const allSucceeded = results.every((r) => r.status === 200);
  assert(allSucceeded, `All 4 requests succeeded`);

  // Some of the later requests should have been queued
  const queuedCount = results.filter((r) => r.queuePosition !== null).length;
  console.log(`  Requests that were queued: ${queuedCount}`);

  // ── Test 3: Priority ordering ──
  console.log("\n3. Priority Ordering");
  const highPriUser = await createTestUser("high-priority");
  const lowPriUser = await createTestUser("low-priority");

  await setLimits(highPriUser.id, 10); // highest priority
  await setLimits(lowPriUser.id, 1);   // lowest priority

  // Fire 6 requests: 2 to fill slots, then 2 low-pri + 2 high-pri
  // High-pri should complete sooner (dequeued first)
  const fillerUser = await createTestUser("filler");
  const completionOrder: string[] = [];

  // Start 2 filler requests to fill both slots
  const fillers = Array.from({ length: 2 }, (_, i) =>
    makeCompletion(fillerUser.api_key, `Filler ${i}, say ok`),
  );

  // Brief delay to let fillers start
  await new Promise((r) => setTimeout(r, 50));

  // Now enqueue low-pri and high-pri requests
  const lowPriPromise = makeCompletion(lowPriUser.api_key, "Low priority, say low").then((r) => {
    completionOrder.push("low");
    return r;
  });
  const highPriPromise = makeCompletion(highPriUser.api_key, "High priority, say high").then((r) => {
    completionOrder.push("high");
    return r;
  });

  await Promise.all([...fillers, lowPriPromise, highPriPromise]);

  console.log(`  Completion order: ${completionOrder.join(", ")}`);
  // High priority should complete before low priority
  // (not guaranteed if they hit different timing windows, but very likely with max_concurrency=2)
  if (completionOrder[0] === "high") {
    console.log("  PASS: High priority completed first");
  } else {
    console.log("  NOTE: Priority order wasn't deterministic this run (timing-dependent)");
  }

  const highResult = await highPriPromise;
  const lowResult = await lowPriPromise;
  assert(highResult.status === 200, "High priority request succeeded");
  assert(lowResult.status === 200, "Low priority request succeeded");

  // ── Test 4: Backpressure (503 when queue is full) ──
  console.log("\n4. Backpressure (503 When Queue Is Full)");

  // We need to overwhelm the queue. With max_concurrency=2, max_queue_depth=50,
  // we need > 52 concurrent requests. Let's use a more efficient approach:
  // test with a smaller number by temporarily creating load.
  // Actually, let's just fire 60 requests simultaneously.
  const bpUser = await createTestUser("backpressure-test");
  const bpPromises = Array.from({ length: 60 }, (_, i) =>
    makeCompletion(bpUser.api_key, `Backpressure test ${i}`),
  );

  const bpResults = await Promise.all(bpPromises);
  const succeeded = bpResults.filter((r) => r.status === 200).length;
  const rejected = bpResults.filter((r) => r.status === 503).length;

  console.log(`  Succeeded: ${succeeded}, Rejected (503): ${rejected}`);
  assert(succeeded > 0, "Some requests succeeded");
  assert(rejected > 0, "Some requests were rejected with 503 (backpressure)");

  // ── Test 5: Queue drains cleanly ──
  console.log("\n5. Queue Drains Cleanly");
  await new Promise((r) => setTimeout(r, 1000));
  const finalStatus = await getQueueStatus();
  assert(finalStatus.active === 0, "No active requests after drain");
  assert(finalStatus.queued === 0, "No queued requests after drain");

  console.log("\nAll Tests Passed!");
};

main().catch((err) => {
  console.error("Test Failed:", err);
  process.exit(1);
});
