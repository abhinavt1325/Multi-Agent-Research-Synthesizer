import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthenticatedShell from "./layouts/AuthenticatedShell";
import DashboardPage from "./pages/DashboardPage";
import ContradictionDetectorPage from "./pages/ContradictionDetectorPage";
import EvidenceComparatorPage from "./pages/EvidenceComparatorPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import GraphExplorerPage from "./pages/GraphExplorerPage";
import LiteratureHunterPage from "./pages/LiteratureHunterPage";
import LoginPage from "./pages/LoginPage";
import PaperReaderPage from "./pages/PaperReaderPage";
import PlannerPage from "./pages/PlannerPage";
import ResearchGapPage from "./pages/ResearchGapPage";
import SignupPage from "./pages/SignupPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AuthenticatedShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/paper-reader" element={<PaperReaderPage />} />
          <Route path="/evidence-comparator" element={<EvidenceComparatorPage />} />
          <Route path="/contradiction-detector" element={<ContradictionDetectorPage />} />
          <Route path="/research-gap" element={<ResearchGapPage />} />
          <Route path="/literature-hunter" element={<LiteratureHunterPage />} />
          <Route path="/graph-explorer" element={<GraphExplorerPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
