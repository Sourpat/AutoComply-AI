import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { CsfOverviewPage } from "./pages/CsfOverviewPage";
import { OhioTdddSandbox } from "./components/OhioTdddSandbox";
import { LicenseOverviewPage } from "./pages/LicenseOverviewPage";
import ConsoleDashboard from "./pages/ConsoleDashboard";
import RagExplorerPage from "./pages/RagExplorerPage";
import CaseWorkspace from "./pages/CaseWorkspace";
import { NyPharmacyLicenseSandbox } from "./components/NyPharmacyLicenseSandbox";
import AutoComplyAiCaseStudy from "./pages/projects/AutoComplyAiCaseStudy";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BackendConnectionIndicator } from "./components/BackendConnectionIndicator";
// Learn After First Unknown pages
import { ChatPage } from "./pages/ChatPage";
import { AdminReviewPage } from "./pages/AdminReviewPage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminOpsDashboard } from "./pages/AdminOpsDashboard";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";
import { ReviewQueuePage } from "./pages/ReviewQueuePage";
import { AgenticWorkbenchPage } from "./pages/AgenticWorkbenchPage";
import { AuditDiffPage } from "./pages/AuditDiffPage";
import { AuditVerifyPage } from "./pages/AuditVerifyPage";
import { AuditPacketViewPage } from "./pages/AuditPacketViewPage";
import CoverageDashboardPage from "./pages/CoverageDashboardPage";
import { AnalyticsDashboardPage } from "./pages/AnalyticsDashboardPage";
import { DiagnosticsBanner } from "./components/DiagnosticsBanner";
// New submission pages
import { OhioTdddSubmissionPage } from "./pages/OhioTdddSubmissionPage";

import { NyPharmacyLicenseSubmissionPage } from "./pages/NyPharmacyLicenseSubmissionPage";
import { CsfFacilitySubmissionPage } from "./pages/CsfFacilitySubmissionPage";

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
            <Route path="/console/cases" element={<CaseWorkspace />} />
            <Route path="/console/rag" element={<RagExplorerPage />} />
            <Route path="/console/review-queue" element={<ReviewQueuePage />} />
            <Route path="/agentic/workbench" element={<AgenticWorkbenchPage />} />
            <Route path="/audit/diff" element={<AuditDiffPage />} />
            <Route path="/audit/verify" element={<AuditVerifyPage />} />
            <Route path="/audit/view" element={<AuditPacketViewPage />} />
            <Route path="/coverage" element={<CoverageDashboardPage />} />
            <Route path="/analytics" element={<AnalyticsDashboardPage />} />
            <Route path="/license/ohio-tddd" element={<OhioTdddSandbox />} />
            <Route
              path="/license/ny-pharmacy"
              element={<NyPharmacyLicenseSandbox />}
            />
            {/* New submission pages */}
            <Route path="/submit/ohio-tddd" element={<OhioTdddSubmissionPage />} />
            <Route path="/submit/ny-pharmacy" element={<NyPharmacyLicenseSubmissionPage />} />
            <Route path="/submit/csf-facility" element={<CsfFacilitySubmissionPage />} />
            <Route
              path="/projects/autocomply-ai"
              element={<AutoComplyAiCaseStudy repoUrl="https://github.com/Sourpat/AutoComply-AI" />}
            />
            {/* Learn After First Unknown routes */}
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route 
              path="/admin/review/*" 
              element={
                <ProtectedAdminRoute>
                  <AdminReviewPage />
                </ProtectedAdminRoute>
              } 
            />
            <Route 
              path="/admin/ops" 
              element={
                <ProtectedAdminRoute>
                  <AdminOpsDashboard />
                </ProtectedAdminRoute>
              } 
            />
          </Routes>
        </Layout>
        <BackendConnectionIndicator />
        <DiagnosticsBanner />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
