const BASE_URL = "http://127.0.0.1:8001";

const EXPECTED_IDS = ["demo-sub-1", "demo-sub-2", "demo-sub-3"];
const ALLOWED_STATUSES = new Set(["approved", "needs_review", "blocked"]);

function fail(message, context = {}) {
  console.error("\nFAIL:", message);
  if (Object.keys(context).length > 0) {
    console.error(JSON.stringify(context, null, 2));
  }
  process.exit(1);
}

async function requestJson(path, { method = "GET", body, headers = {} } = {}) {
  const url = new URL(path, BASE_URL).toString();
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const rawText = await response.text();
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      fail("Response was not valid JSON", {
        url,
        status: response.status,
        rawText,
      });
    }
  }

  if (!response.ok) {
    fail("Request failed", {
      url,
      method,
      status: response.status,
      payload: body ?? null,
      response: data ?? rawText,
    });
  }

  return { url, data };
}

function hasTruthGateSignal(debug) {
  if (!debug || typeof debug !== "object") return false;
  const note = String(debug.note ?? "").toLowerCase();
  if (note.includes("no_supporting_evidence_found")) return true;

  for (const [key, value] of Object.entries(debug)) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes("truth") || keyLower.includes("gate")) {
      if (value === true) return true;
      if (typeof value === "string" && value.toLowerCase().includes("true")) return true;
      if (typeof value === "string" && value.trim().length > 0) return true;
    }
  }
  return false;
}

function validateExplainResult({ submissionId, result }) {
  if (!result) {
    fail("Explain response missing body", { submissionId });
  }

  if (result.submission_id !== submissionId) {
    fail("Explain submission_id mismatch", {
      submissionId,
      responseSubmissionId: result.submission_id,
    });
  }

  if (!ALLOWED_STATUSES.has(result.status)) {
    fail("Explain status invalid", {
      submissionId,
      status: result.status,
      allowed: Array.from(ALLOWED_STATUSES),
    });
  }

  const firedRules = Array.isArray(result.fired_rules) ? result.fired_rules : [];
  const citations = Array.isArray(result.citations) ? result.citations : [];

  if (submissionId === "demo-sub-3") {
    if (result.status !== "blocked") {
      fail("demo-sub-3 must be blocked", {
        submissionId,
        status: result.status,
      });
    }

    const hasOhTddd = firedRules.some((rule) => {
      if (!rule) return false;
      if (typeof rule === "string") return rule === "OH_TDDD_REQUIRED";
      return rule.id === "OH_TDDD_REQUIRED" || rule.rule_id === "OH_TDDD_REQUIRED";
    });

    if (!hasOhTddd) {
      fail("demo-sub-3 missing OH_TDDD_REQUIRED fired rule", {
        submissionId,
        fired_rules: firedRules,
      });
    }
  }

  if (firedRules.length > 0 && citations.length === 0) {
    const debug = result.debug ?? {};
    if (!hasTruthGateSignal(debug)) {
      fail("Missing truth-gate or no_supporting_evidence_found signal", {
        submissionId,
        fired_rules: firedRules.map((rule) => rule?.id ?? rule?.rule_id ?? rule),
        citations_count: citations.length,
        debug,
      });
    }
  }
}

async function run() {
  console.log("\nRAG E2E smoke check\n--------------------");

  const seed = await requestJson("/api/ops/seed-submissions", { method: "POST" });
  console.log("PASS: seed-submissions", seed.data);

  const recent = await requestJson("/api/rag/submissions/recent");
  const submissions = Array.isArray(recent.data?.submissions) ? recent.data.submissions : [];
  if (submissions.length === 0) {
    fail("Recent submissions empty", { response: recent.data });
  }
  console.log("PASS: recent submissions", { count: submissions.length });

  const recentIds = submissions.map((item) => item.submission_id).filter(Boolean);
  const hasAllExpected = EXPECTED_IDS.every((id) => recentIds.includes(id));
  const idsToCheck = hasAllExpected ? EXPECTED_IDS : recentIds.slice(0, 3);

  if (idsToCheck.length === 0) {
    fail("No submission IDs available to check", { recentIds });
  }

  if (!hasAllExpected) {
    console.warn("WARN: Expected demo submission IDs not all present. Using recent list.", {
      expected: EXPECTED_IDS,
      recentIds,
    });
  }

  for (const submissionId of idsToCheck) {
    const explain = await requestJson("/api/rag/explain/v1", {
      method: "POST",
      body: { submission_id: submissionId },
    });

    validateExplainResult({ submissionId, result: explain.data });
    console.log(`PASS: explain v1 (${submissionId})`);
  }

  console.log("\nPASS: RAG E2E smoke check complete\n");
}

run().catch((err) => {
  fail("Unhandled error", { error: err?.message ?? String(err) });
});
