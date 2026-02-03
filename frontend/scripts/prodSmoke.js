const base = process.env.VITE_API_BASE_URL;

if (!base) {
  console.error("VITE_API_BASE_URL is required (example: https://autocomply-ai.onrender.com)");
  process.exit(1);
}

const endpoints = [
  { path: "/health/full", keys: ["status", "build_sha"] },
  { path: "/api/ops/smoke", keys: ["db_ok", "schema_ok", "signing_enabled", "active_contract_present", "env", "build_sha"] },
  { path: "/api/audit/signing/status", keys: ["enabled", "key_present", "key_fingerprint", "environment"] },
];

const joinUrl = (baseUrl, path) => `${baseUrl.replace(/\/$/, "")}${path}`;

async function checkEndpoint({ path, keys }) {
  const url = joinUrl(base, path);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${path} failed with ${res.status}`);
  }
  const json = await res.json();
  const missing = keys.filter((key) => !(key in json));
  if (missing.length > 0) {
    throw new Error(`${path} missing keys: ${missing.join(", ")}`);
  }
  return json;
}

(async () => {
  try {
    console.log(`Prod smoke base: ${base}`);
    for (const endpoint of endpoints) {
      const data = await checkEndpoint(endpoint);
      console.log(`✓ ${endpoint.path}`, data);
    }
    console.log("Prod smoke checks passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
