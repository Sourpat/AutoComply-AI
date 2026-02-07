import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateResearcherCsf } from "../api/csfResearcherClient";

vi.mock("../api/csfResearcherClient", () => ({
  evaluateResearcherCsf: vi.fn(),
}));

const mockCopilotResponse = {
  status: "ok_to_ship",
  reason: "Researcher CSF is approved to proceed.",
  missing_fields: [],
  regulatory_references: ["csf_researcher_form"],
  rag_explanation: "This Researcher CSF is compliant based on example rules.",
  rag_sources: [
    {
      id: "csf_researcher_form",
      title: "Controlled Substance Form – Researcher",
      url: "https://example.com/csf-researcher",
      snippet: "Example snippet from the Researcher CSF doc.",
    },
  ],
  artifacts_used: ["csf_researcher_form"],
};

function mockFetchSequence(responses: Response[]) {
  const fetchMock = vi.fn();
  responses.forEach((resp) => fetchMock.mockResolvedValueOnce(resp));
  // @ts-expect-error - assign mock to global
  global.fetch = fetchMock;
  return fetchMock;
}

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

async function loadSandbox() {
  vi.resetModules();
  return import("./ResearcherCsfSandbox");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
  // @ts-expect-error - cleanup test-specific fetch mocks
  delete global.fetch;
});

describe("Researcher CSF Sandbox", () => {
  it("renders Researcher CSF Sandbox with Researcher-specific labels", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const { ResearcherCsfSandbox } = await loadSandbox();

    renderWithRouter(<ResearcherCsfSandbox />);

    expect(screen.getByText(/Researcher CSF Sandbox/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Researcher controlled substance forms/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/EMS CSF Sandbox/i)).toBeNull();
  });

  it("shows Researcher CSF example scenarios", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const { ResearcherCsfSandbox } = await loadSandbox();

    renderWithRouter(<ResearcherCsfSandbox />);

    expect(
      screen.getByRole("button", { name: /Researcher CSF.*complete/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Researcher CSF.*missing/i })
    ).toBeInTheDocument();
  });

  it("calls evaluateResearcherCsf and shows decision result", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const { ResearcherCsfSandbox } = await loadSandbox();

    (evaluateResearcherCsf as unknown as vi.Mock).mockResolvedValue({
      status: "ok_to_ship",
      reason: "Researcher CSF is approved to proceed.",
      missing_fields: [],
      regulatory_references: [],
    });

    renderWithRouter(<ResearcherCsfSandbox />);

    fireEvent.click(
      screen.getByRole("button", { name: /Researcher CSF.*complete/i })
    );

    const evaluateButton = screen.getByRole("button", {
      name: /evaluate researcher csf/i,
    });

    fireEvent.click(evaluateButton);

    await waitFor(() =>
      expect(
        screen.getByText(/Researcher CSF is approved to proceed/i)
      ).toBeInTheDocument()
    );
  });

  it("calls Researcher Form Copilot and renders RAG details", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const { ResearcherCsfSandbox } = await loadSandbox();

    const fetchMock = mockFetchSequence([
      new Response(JSON.stringify(mockCopilotResponse), { status: 200 }),
    ]);

    renderWithRouter(<ResearcherCsfSandbox />);

    fireEvent.click(
      screen.getByRole("button", { name: /Researcher CSF.*complete/i })
    );

    const copilotButton = screen.getByRole("button", {
      name: /check & explain/i,
    });

    fireEvent.click(copilotButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const calls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(
      calls.some((url) => url.includes("/csf/researcher/form-copilot"))
    ).toBe(true);

    expect(
      screen.getByText(/Researcher CSF is approved to proceed/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This Researcher CSF is compliant based on example rules./i)
    ).toBeInTheDocument();
    expect(screen.getByText(/csf_researcher_form/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Controlled Substance Form – Researcher/i)
    ).toBeInTheDocument();
  });

  it("shows Researcher-specific error when Copilot fails", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const { ResearcherCsfSandbox } = await loadSandbox();

    const fetchMock = vi.fn().mockRejectedValue(new Error(""));
    // @ts-expect-error - assign mock to global
    global.fetch = fetchMock;

    renderWithRouter(<ResearcherCsfSandbox />);

    fireEvent.click(
      screen.getByRole("button", { name: /Researcher CSF.*complete/i })
    );

    const copilotButton = screen.getByRole("button", {
      name: /check & explain/i,
    });

    fireEvent.click(copilotButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(
      screen.getByText(
        /Researcher CSF Copilot could not run. Please check the form and try again./i
      )
    ).toBeInTheDocument();
  });
});
