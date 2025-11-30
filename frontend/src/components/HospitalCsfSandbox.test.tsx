import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockCopilotResponse = {
  status: "ok_to_ship",
  reason: "Hospital copilot reason",
  missing_fields: [],
  regulatory_references: ["csf_hospital_form"],
  rag_explanation: "Hospital copilot explanation",
  rag_sources: [],
  artifacts_used: [],
};

function mockFetchSequence(responses: Response[]) {
  const fetchMock = vi.fn();
  responses.forEach((resp) => fetchMock.mockResolvedValueOnce(resp));
  global.fetch = fetchMock as any;
  return fetchMock;
}

async function loadSandbox() {
  vi.resetModules();
  return import("./HospitalCsfSandbox");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  // @ts-expect-error - cleanup test-specific fetch mocks
  delete global.fetch;
});

describe("Hospital CSF Form Copilot", () => {
  it("renders copilot section and calls the hospital endpoint", async () => {
    vi.stubEnv("VITE_API_BASE", "http://api.test");
    const { HospitalCsfSandbox } = await loadSandbox();

    const fetchMock = mockFetchSequence([
      new Response(JSON.stringify(mockCopilotResponse), { status: 200 }),
    ]);

    render(<HospitalCsfSandbox />);

    expect(screen.getByText(/Form Copilot \(beta\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /check & explain/i }));

    await waitFor(() =>
      expect(
        screen.getByText(mockCopilotResponse.rag_explanation)
      ).toBeInTheDocument()
    );

    const calls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(calls.some((url) => url.includes("/csf/hospital/form-copilot"))).toBe(
      true
    );
  });
});
