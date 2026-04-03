import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Journals from "@/pages/Journals";
import Ledger from "@/pages/Ledger";
import Assets from "@/pages/Assets";
import Reconciliation from "@/pages/Reconciliation";
import TrialBalance from "@/pages/reports/TrialBalance";
import ProfitLoss from "@/pages/reports/ProfitLoss";
import BalanceSheet from "@/pages/reports/BalanceSheet";
import GSTReports from "@/pages/reports/GSTReports";
import Settings from "@/pages/Settings";
import Clients from "@/pages/Clients";

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-app flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      <Route path="/journals" element={<ProtectedRoute><Journals /></ProtectedRoute>} />
      <Route path="/ledger" element={<ProtectedRoute><Ledger /></ProtectedRoute>} />
      <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
      <Route path="/reconciliation" element={<ProtectedRoute><Reconciliation /></ProtectedRoute>} />
      <Route path="/reports/trial-balance" element={<ProtectedRoute><TrialBalance /></ProtectedRoute>} />
      <Route path="/reports/profit-loss" element={<ProtectedRoute><ProfitLoss /></ProtectedRoute>} />
      <Route path="/reports/balance-sheet" element={<ProtectedRoute><BalanceSheet /></ProtectedRoute>} />
      <Route path="/reports/gst" element={<ProtectedRoute><GSTReports /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute adminOnly><Clients /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
