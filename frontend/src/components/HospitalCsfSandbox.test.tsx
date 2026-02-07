import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateOhioTdddLicense } from "../api/licenseOhioTdddClient";

vi.mock("../api/licenseOhioTdddClient", () => ({
  evaluateOhioTdddLicense: vi.fn(),
}));

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

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

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

    renderWithRouter(<HospitalCsfSandbox />);

    expect(
      screen.getByRole("heading", { name: /hospital csf sandbox/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Form Copilot \(beta\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /check & explain/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/Hospital CSF – Form Copilot/i)
      ).toBeInTheDocument()
    );

    expect(
      screen.getByText(/Hospital copilot reason/i)
    ).toBeInTheDocument();

    const calls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(calls.some((url) => url.includes("/csf/hospital/form-copilot"))).toBe(
      true
    );
  });
});

describe("Hospital CSF Ohio TDDD integration", () => {
  it("can trigger Ohio TDDD license check from Hospital CSF sandbox", async () => {
    (evaluateOhioTdddLicense as vi.Mock).mockResolvedValue({
      status: "ok_to_ship",
      reason: "Ohio TDDD license details appear complete for this request.",
      missingFields: [],
    });

    const { HospitalCsfSandbox } = await loadSandbox();

    renderWithRouter(<HospitalCsfSandbox />);

    const button = screen.getByRole("button", {
      name: /Run Ohio TDDD license check/i,
    });

    fireEvent.click(button);

    await waitFor(() =>
      expect(evaluateOhioTdddLicense).toHaveBeenCalledTimes(1)
    );

    expect(
      screen.getByText(/Ohio TDDD license details appear complete/i)
    ).toBeInTheDocument();
  });
});
