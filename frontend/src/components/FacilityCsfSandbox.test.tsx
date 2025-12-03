import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockCopilotResponse = {
  status: "ok_to_ship",
  reason: "Facility CSF is approved to proceed.",
  missing_fields: [],
  regulatory_references: ["csf_facility_form:section_3"],
  rag_explanation: "This Facility CSF is compliant based on example rules.",
  rag_sources: [
    {
      id: "csf_facility_form",
      title: "Controlled Substance Form – Facility",
      url: "https://example.com/csf-facility",
      snippet: "Example snippet from the CSF doc.",
    },
  ],
  artifacts_used: ["csf_facility_form"],
};

function mockFetchSequence(responses: Response[]) {
  const fetchMock = vi.fn();
  responses.forEach((resp) => fetchMock.mockResolvedValueOnce(resp));
  global.fetch = fetchMock as any;
  return fetchMock;
}

async function loadSandbox() {
  vi.resetModules();
  return import("./FacilityCsfSandbox");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
  // @ts-expect-error - cleanup test-specific fetch mocks
  delete global.fetch;
});

describe("Facility CSF Sandbox", () => {
  it("renders Facility CSF Sandbox with Facility-specific labels", async () => {
    vi.stubEnv("VITE_API_BASE", "http://api.test");
    const { FacilityCsfSandbox } = await loadSandbox();

    render(<FacilityCsfSandbox />);

    expect(screen.getByText(/Facility CSF Sandbox/i)).toBeInTheDocument();
    expect(
      screen.getByText(/facility controlled substance forms/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Hospital CSF/i)).toBeNull();
  });

  it("shows multiple Facility CSF example scenarios", async () => {
    vi.stubEnv("VITE_API_BASE", "http://api.test");
    const { FacilityCsfSandbox } = await loadSandbox();

    render(<FacilityCsfSandbox />);

    expect(
      screen.getByText(/Multi-site clinic chain \(happy path\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Long-term care facility \(needs review\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ambulatory surgery center \(blocked\)/i)
    ).toBeInTheDocument();
  });

  it("calls evaluateFacilityCsf and shows decision result", async () => {
    vi.stubEnv("VITE_API_BASE", "http://api.test");
    const { FacilityCsfSandbox } = await loadSandbox();

    const fetchMock = mockFetchSequence([
      new Response(
        JSON.stringify({
          status: "ok_to_ship",
          reason: "Facility CSF is approved to proceed.",
          missing_fields: [],
          regulatory_references: [],
        }),
        { status: 200 }
      ),
    ]);

    render(<FacilityCsfSandbox />);

    const evaluateButton = screen.getByRole("button", {
      name: /evaluate facility csf/i,
    });

    fireEvent.click(evaluateButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const calls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(calls.some((url) => url.includes("/csf/facility/evaluate"))).toBe(
      true
    );

    expect(
      screen.getByText(/Facility CSF is approved to proceed/i)
    ).toBeInTheDocument();
  });

  it("calls Facility Form Copilot and renders RAG details", async () => {
    vi.stubEnv("VITE_API_BASE", "http://api.test");
    const { FacilityCsfSandbox } = await loadSandbox();

    const fetchMock = mockFetchSequence([
      new Response(JSON.stringify(mockCopilotResponse), { status: 200 }),
    ]);

    render(<FacilityCsfSandbox />);

    const copilotButton = screen.getByRole("button", {
      name: /check & explain/i,
    });

    fireEvent.click(copilotButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const calls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(calls.some((url) => url.includes("/csf/facility/form-copilot"))).toBe(
      true
    );

    expect(
      screen.getByText(/Facility CSF is approved to proceed/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This Facility CSF is compliant based on example rules./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/csf_facility_form:section_3/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Controlled Substance Form – Facility/i)
    ).toBeInTheDocument();
  });

  it("shows Facility-specific error when Copilot fails", async () => {
    vi.stubEnv("VITE_API_BASE", "http://api.test");
    const { FacilityCsfSandbox } = await loadSandbox();

    const fetchMock = vi.fn().mockRejectedValue(new Error(""));
    global.fetch = fetchMock as any;

    render(<FacilityCsfSandbox />);

    const copilotButton = screen.getByRole("button", {
      name: /check & explain/i,
    });

    fireEvent.click(copilotButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(
      screen.getByText(
        /Facility CSF Copilot could not run. Please check the form and try again./i
      )
    ).toBeInTheDocument();
  });

  it("renders cURL snippet pointing to /csf/facility/evaluate", async () => {
    vi.stubEnv("VITE_API_BASE", "http://api.test");
    const { FacilityCsfSandbox } = await loadSandbox();

    const writeText = vi.fn().mockResolvedValue(undefined);
    // @ts-expect-error - jsdom doesn't fully type clipboard
    navigator.clipboard = { writeText };

    render(<FacilityCsfSandbox />);

    fireEvent.click(
      screen.getByRole("button", { name: /copy curl \(evaluate\)/i })
    );

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toMatch(/csf\/facility\/evaluate/);
  });
});
