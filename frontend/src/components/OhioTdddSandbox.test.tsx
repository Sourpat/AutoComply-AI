import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { OhioTdddSandbox } from "./OhioTdddSandbox";

vi.mock("../api/licenseOhioTdddClient", () => ({
  evaluateOhioTdddLicense: vi.fn(),
}));

vi.mock("../api/licenseOhioTdddCopilotClient", () => ({
  callOhioTdddFormCopilot: vi.fn(),
}));

import { evaluateOhioTdddLicense } from "../api/licenseOhioTdddClient";
import { callOhioTdddFormCopilot } from "../api/licenseOhioTdddCopilotClient";

describe("OhioTdddSandbox", () => {
  it("renders Ohio TDDD License Sandbox header", () => {
    render(<OhioTdddSandbox />);

    expect(screen.getByText(/Ohio TDDD License Sandbox/i)).toBeInTheDocument();
  });

  it("calls evaluateOhioTdddLicense and shows decision", async () => {
    (evaluateOhioTdddLicense as vi.Mock).mockResolvedValue({
      status: "ok_to_ship",
      reason: "Ohio TDDD license details appear complete for this request.",
      missingFields: [],
    });

    render(<OhioTdddSandbox />);

    const button = screen.getByRole("button", {
      name: /Evaluate Ohio TDDD License/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(evaluateOhioTdddLicense).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByText(/Ohio TDDD license details appear complete/i)
    ).toBeInTheDocument();
  });

  it("calls Ohio TDDD Form Copilot and renders explanation", async () => {
    (callOhioTdddFormCopilot as vi.Mock).mockResolvedValue({
      status: "ok_to_ship",
      reason: "License appears valid under Ohio TDDD rules.",
      missing_fields: [],
      regulatory_references: ["ohio_tddd_rules:section_1"],
      rag_explanation: "Example explanation for Ohio TDDD.",
      artifacts_used: ["ohio_tddd_rules"],
      rag_sources: [
        {
          id: "ohio_tddd_rules",
          title: "Ohio TDDD – Terminal Distributor of Dangerous Drugs Rules",
          url: "https://example.com/ohio-tddd",
          snippet: "Example snippet from the Ohio TDDD rules.",
        },
      ],
    });

    render(<OhioTdddSandbox />);

    const button = screen.getByRole("button", {
      name: /Check & Explain/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(callOhioTdddFormCopilot).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByText(/License appears valid under Ohio TDDD rules/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Ohio TDDD – Terminal Distributor of Dangerous Drugs Rules/i
      )
    ).toBeInTheDocument();
  });
});
