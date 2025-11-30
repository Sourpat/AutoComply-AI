import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const bannerText =
  "Sandbox misconfigured: missing API base URL. Please set VITE_API_BASE in your environment before using Practitioner CSF tools.";

const mockEvaluationDecision = {
  status: "blocked",
  reason: "Missing verification",
  missing_fields: [],
  regulatory_references: [],
};

const mockAllowedDecision = {
  status: "ok_to_ship",
  reason: "All clear",
  missing_fields: [],
  regulatory_references: [],
};

async function loadSandbox() {
  vi.resetModules();
  return import("./PractitionerCsfSandbox");
}

function mockFetchSequence(responses: Response[]) {
  const fetchMock = vi.fn();
  responses.forEach((resp) => fetchMock.mockResolvedValueOnce(resp));
  global.fetch = fetchMock as any;
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  // @ts-expect-error - cleanup test-specific fetch mocks
  delete global.fetch;
});

describe("PractitionerCsfSandbox", () => {
  it("shows an API base banner when VITE_API_BASE is missing", async () => {
    vi.stubEnv("VITE_API_BASE", "");
    const { PractitionerCsfSandbox } = await loadSandbox();

    render(<PractitionerCsfSandbox />);

    expect(screen.getByText(bannerText)).toBeInTheDocument();
  });

  it("surfaces verification failures to the user", async () => {
    vi.stubEnv("VITE_API_BASE", "http://api.test");
    const { PractitionerCsfSandbox } = await loadSandbox();

    mockFetchSequence([
      new Response(JSON.stringify(mockEvaluationDecision), { status: 200 }),
      new Response(JSON.stringify({ id: "snap-1" }), { status: 200 }),
      new Response("verify fail", { status: 500 }),
    ]);

    render(<PractitionerCsfSandbox />);

    fireEvent.click(
      screen.getByRole("button", { name: /evaluate practitioner csf/i })
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          "Verification request failed. Please try again or contact support if this persists."
        )
      ).toBeInTheDocument()
    );
  });

  it("surfaces deep RAG explain failures", async () => {
    vi.stubEnv("VITE_API_BASE", "http://api.test");
    const { PractitionerCsfSandbox } = await loadSandbox();

    mockFetchSequence([
      new Response(JSON.stringify(mockAllowedDecision), { status: 200 }),
      new Response(JSON.stringify({ id: "snap-2" }), { status: 200 }),
      new Response("rag fail", { status: 500 }),
    ]);

    render(<PractitionerCsfSandbox />);

    fireEvent.click(
      screen.getByRole("button", { name: /evaluate practitioner csf/i })
    );

    await waitFor(() =>
      expect(screen.getAllByText(/decision/i).length).toBeGreaterThan(0)
    );

    fireEvent.click(screen.getByRole("button", { name: /deep rag explain/i }));

    await waitFor(() =>
      expect(
        screen.getByText("Deep regulatory explain is temporarily unavailable.")
      ).toBeInTheDocument()
    );
  });
});
