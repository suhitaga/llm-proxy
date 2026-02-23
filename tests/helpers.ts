const BASE_URL = "http://localhost:8000";

type TestUser = {
  id: string;
  name: string;
  api_key: string;
};

const createTestUser = async (name: string): Promise<TestUser> => {
  const res = await fetch(`${BASE_URL}/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json() as Promise<TestUser>;
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  PASS: ${message}`);
};

export { BASE_URL, createTestUser, assert };
export type { TestUser };
