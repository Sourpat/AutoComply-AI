import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LicenseOverviewPage } from "../LicenseOverviewPage";

describe("LicenseOverviewPage", () => {
  it("renders license overview header and license suite cards", () => {
    render(
      <MemoryRouter>
        <LicenseOverviewPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/License Compliance – AutoComply AI Playground/i)
    ).toBeInTheDocument();

    expect(screen.getByText(/Ohio TDDD License Sandbox/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Ohio TDDD License Sandbox/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/NY Pharmacy License Sandbox/i)).toBeInTheDocument();
    // NY card copy is subject to change; assert a stable visible label instead
    expect(
      screen.getByText(/New York pharmacy license verification/i)
    ).toBeInTheDocument();
  });
});
