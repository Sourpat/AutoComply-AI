import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateEmsCsf } from "../api/csfEmsClient";

vi.mock("../api/csfEmsClient", () => ({
  evaluateEmsCsf: vi.fn(),
}));

const mockCopilotResponse = {
  status: "ok_to_ship",
  reason: "EMS CSF is approved to proceed.",
  missing_fields: [],
  regulatory_references: ["csf_ems_form:section_3"],
  rag_explanation: "This EMS CSF is compliant based on example rules.",
  rag_sources: [
    {
      id: "csf_ems_form",
      title: "Controlled Substance Form – EMS",
      url: "https://example.com/csf-ems",
      snippet: "Example snippet from the EMS CSF doc.",
    },
  ],
  artifacts_used: ["csf_ems_form"],
};

function mockFetchSequence(responses: Response[]) {
  const fetchMock = vi.fn();
  responses.forEach((resp) => fetchMock.mockResolvedValueOnce(resp));
  global.fetch = fetchMock as any;
  return fetchMock;
}

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

async function loadSandbox() {
  vi.resetModules();
  return import("./EmsCsfSandbox");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
  // @ts-expect-error - cleanup test-specific fetch mocks
  delete global.fetch;
});

describe("EMS CSF Sandbox", () => {
  it("renders EMS CSF Sandbox with EMS-specific labels", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const { EmsCsfSandbox } = await loadSandbox();

    renderWithRouter(<EmsCsfSandbox />);

    expect(screen.getByText(/EMS CSF Sandbox/i)).toBeInTheDocument();
    expect(
      screen.getByText(/EMS controlled substance forms/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Hospital CSF/i)).toBeNull();
  });

  it("shows multiple EMS CSF example scenarios", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const { EmsCsfSandbox } = await loadSandbox();

    renderWithRouter(<EmsCsfSandbox />);

    expect(
      screen.getByRole("button", { name: /EMS CSF – complete & compliant/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /EMS CSF – missing critical info/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /EMS CSF – high-risk responses/i })
    ).toBeInTheDocument();
  });

  it("calls evaluateEmsCsf and shows decision result", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const { EmsCsfSandbox } = await loadSandbox();

    (evaluateEmsCsf as unknown as vi.Mock).mockResolvedValue({
      status: "ok_to_ship",
      reason: "EMS CSF is approved to proceed.",
      missing_fields: [],
      regulatory_references: [],
    });

    renderWithRouter(<EmsCsfSandbox />);

    const evaluateButton = screen.getByRole("button", {
      name: /evaluate ems csf/i,
    });

    fireEvent.click(evaluateButton);

    await waitFor(() =>
      expect(
        screen.getByText(/EMS CSF is approved to proceed/i)
      ).toBeInTheDocument()
    );
  });

  it("calls EMS Form Copilot and renders RAG details", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const { EmsCsfSandbox } = await loadSandbox();

    const fetchMock = mockFetchSequence([
      new Response(JSON.stringify(mockCopilotResponse), { status: 200 }),
    ]);

    renderWithRouter(<EmsCsfSandbox />);

    const copilotButton = screen.getByRole("button", {
      name: /check & explain/i,
    });

    fireEvent.click(copilotButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const calls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(calls.some((url) => url.includes("/csf/ems/form-copilot"))).toBe(true);

    expect(
      screen.getByText(/EMS CSF is approved to proceed/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This EMS CSF is compliant based on example rules./i)
    ).toBeInTheDocument();
    expect(screen.getByText(/csf_ems_form:section_3/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Controlled Substance Form – EMS/i)
    ).toBeInTheDocument();
  });

  it("shows EMS-specific error when Copilot fails", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const { EmsCsfSandbox } = await loadSandbox();

    const fetchMock = vi.fn().mockRejectedValue(new Error(""));
    global.fetch = fetchMock as any;

    renderWithRouter(<EmsCsfSandbox />);

    const copilotButton = screen.getByRole("button", {
      name: /check & explain/i,
    });

    fireEvent.click(copilotButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(
      screen.getByText(
        /EMS CSF Copilot could not run. Please check the form and try again./i
      )
    ).toBeInTheDocument();
  });

  it("renders cURL snippet pointing to /csf/ems/evaluate", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const { EmsCsfSandbox } = await loadSandbox();

    const writeText = vi.fn().mockResolvedValue(undefined);
    // @ts-expect-error - jsdom doesn't fully type clipboard
    navigator.clipboard = { writeText };

    renderWithRouter(<EmsCsfSandbox />);

    fireEvent.click(
      screen.getByRole("button", { name: /copy curl \(evaluate\)/i })
    );

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toMatch(/csf\/ems\/evaluate/);
  });
});
