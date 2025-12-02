import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import { CsfOverviewPage } from "./pages/CsfOverviewPage";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/csf" element={<CsfOverviewPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
