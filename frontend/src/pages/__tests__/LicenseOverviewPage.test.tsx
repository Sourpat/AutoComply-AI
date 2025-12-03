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
      screen.getByText(
        /Evaluate Ohio Terminal Distributor of Dangerous Drugs licenses and see exactly when an account is ok_to_ship, needs_review, or blocked./i
      )
    ).toBeInTheDocument();

    expect(screen.getByText(/NY Pharmacy License Sandbox/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Run New York pharmacy license checks and understand how license status drives downstream order decisions./i
      )
    ).toBeInTheDocument();
  });
});
