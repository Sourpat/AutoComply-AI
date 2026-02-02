import { API_BASE } from "../lib/api";

/**
 * Generic API wrapper for AutoComply AI
 * Centralizes:
 *  - Response handling
 *  - Error normalization
 *  - File uploads
 */

export async function validateLicenseJSON(payload) {
  const res = await fetch(`${API_BASE}/api/v1/validate/license`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse(res);
}

export async function validateLicensePDF(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/v1/validate/license`, {
    method: "POST",
    body: formData,
  });

  return handleResponse(res);
}

async function handleResponse(res) {
  if (!res.ok) {
    let msg = "Something went wrong.";

    try {
      const err = await res.json();
      msg = err.detail || JSON.stringify(err);
    } catch (e) {
      // ignore
    }

    return {
      success: false,
      error: msg,
    };
  }

  return await res.json();
}

export async function explainRule({ state, purchase_intent }) {
  const payload = {
    state,
    purchase_intent,
  };

  const response = await fetch(
    `${API_BASE}/api/v1/licenses/explain-rule`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Failed to explain rule (${response.status}): ${text || "no response body"}`
    );
  }

  return response.json();
}
