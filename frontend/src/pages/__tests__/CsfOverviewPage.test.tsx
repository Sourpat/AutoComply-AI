import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CsfOverviewPage } from "../CsfOverviewPage";

describe("CsfOverviewPage", () => {
  it("renders CSF overview header and all sandbox sections", () => {
    render(
      <MemoryRouter>
        <CsfOverviewPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(
        /Controlled Substance Forms \(CSF\) – AutoComply AI Playground/i
      )
    ).toBeInTheDocument();

    expect(screen.getAllByText(/Hospital CSF Sandbox/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Practitioner CSF Sandbox/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Facility CSF Sandbox/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/EMS CSF Sandbox/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Researcher CSF Sandbox/i).length).toBeGreaterThan(0);
  });
});
