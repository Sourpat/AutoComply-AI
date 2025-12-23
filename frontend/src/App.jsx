import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { CsfOverviewPage } from "./pages/CsfOverviewPage";
import { OhioTdddSandbox } from "./components/OhioTdddSandbox";
import { LicenseOverviewPage } from "./pages/LicenseOverviewPage";
import ConsoleDashboard from "./pages/ConsoleDashboard";
import { NyPharmacyLicenseSandbox } from "./components/NyPharmacyLicenseSandbox";
import AutoComplyAiCaseStudy from "./pages/projects/AutoComplyAiCaseStudy";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BackendConnectionIndicator } from "./components/BackendConnectionIndicator";
// Learn After First Unknown pages
import { ChatPage } from "./pages/ChatPage";
import { AdminReviewPage } from "./pages/AdminReviewPage";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/csf" element={<CsfOverviewPage />} />
            <Route path="/csf/:sandboxId" element={<CsfOverviewPage />} />
            <Route path="/license" element={<LicenseOverviewPage />} />
            <Route path="/console" element={<ConsoleDashboard />} />
            <Route path="/license/ohio-tddd" element={<OhioTdddSandbox />} />
            <Route
              path="/license/ny-pharmacy"
              element={<NyPharmacyLicenseSandbox />}
            />
            <Route
              path="/projects/autocomply-ai"
              element={<AutoComplyAiCaseStudy repoUrl="https://github.com/Sourpat/AutoComply-AI" />}
            />
            {/* Learn After First Unknown routes */}
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/admin/review/*" element={<AdminReviewPage />} />
          </Routes>
        </Layout>
        <BackendConnectionIndicator />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
