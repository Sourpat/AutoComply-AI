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

const mockCopilotResponse = {
  status: "ok_to_ship",
  reason: "Practitioner CSF is approved to proceed.",
  missing_fields: [],
  regulatory_references: ["csf_practitioner_form"],
  rag_explanation: "This Practitioner CSF is compliant based on example rules.",
  rag_sources: [
    {
      id: "csf_practitioner_form",
      title: "Controlled Substance Form – Practitioner (with addendums)",
      url: "https://example.com/csf-practitioner",
      snippet: "Example snippet from the Practitioner CSF doc.",
    },
  ],
  artifacts_used: ["csf_practitioner_form"],
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
  // @ts-expect-error
  delete navigator.clipboard;
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

  it("calls Practitioner Form Copilot and renders RAG details", async () => {
    vi.stubEnv("VITE_API_BASE", "http://api.test");
    const { PractitionerCsfSandbox } = await loadSandbox();

    const fetchMock = mockFetchSequence([
      new Response(JSON.stringify(mockCopilotResponse), { status: 200 }),
    ]);

    render(<PractitionerCsfSandbox />);

    const copilotButton = screen.getByRole("button", {
      name: /check & explain/i,
    });

    fireEvent.click(copilotButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const calls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(
      calls.some((url) => url.includes("/csf/practitioner/form-copilot"))
    ).toBe(true);

    expect(
      screen.getAllByText(/Practitioner CSF is approved to proceed/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /This Practitioner CSF is compliant based on example rules./i
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/csf_practitioner_form/i)).toBeInTheDocument();
  });

  it("copies the practitioner evaluate cURL snippet", async () => {
    vi.stubEnv("VITE_API_BASE", "http://api.test");
    const { PractitionerCsfSandbox } = await loadSandbox();

    const writeText = vi.fn();
    // @ts-expect-error - test shim
    navigator.clipboard = { writeText };

    render(<PractitionerCsfSandbox />);

    fireEvent.click(
      screen.getByRole("button", { name: /copy curl \(evaluate\)/i })
    );

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const curl = writeText.mock.calls[0][0] as string;
    expect(curl).toContain("/csf/practitioner/evaluate");
  });
});
