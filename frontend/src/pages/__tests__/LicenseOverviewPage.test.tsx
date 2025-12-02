import { render, screen } from "@testing-library/react";
import { LicenseOverviewPage } from "../LicenseOverviewPage";

describe("LicenseOverviewPage", () => {
  it("renders license overview header and Ohio TDDD section", () => {
    render(<LicenseOverviewPage />);

    expect(
      screen.getByText(/License Compliance – AutoComply AI Playground/i)
    ).toBeInTheDocument();

    expect(screen.getAllByText(/Ohio TDDD License Sandbox/i).length).toBeGreaterThan(0);

    expect(screen.getByText(/Evaluate and explain Ohio TDDD/i)).toBeInTheDocument();
  });
});
