import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import { CsfOverviewPage } from "./pages/CsfOverviewPage";
import { OhioTdddSandbox } from "./components/OhioTdddSandbox";
import { LicenseOverviewPage } from "./pages/LicenseOverviewPage";
import { ComplianceConsolePage } from "./pages/ComplianceConsolePage";
import { NyPharmacyLicenseSandbox } from "./components/NyPharmacyLicenseSandbox";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/csf" element={<CsfOverviewPage />} />
          <Route path="/license" element={<LicenseOverviewPage />} />
          <Route path="/console" element={<ComplianceConsolePage />} />
          <Route path="/license/ohio-tddd" element={<OhioTdddSandbox />} />
          <Route
            path="/license/ny-pharmacy"
            element={<NyPharmacyLicenseSandbox />}
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
