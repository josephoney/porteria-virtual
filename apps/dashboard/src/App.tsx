import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { RequireAuth, RequireRole } from './components/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { OperatorPanel } from './components/operator/OperatorPanel';
import { AdminPanel } from './components/admin/AdminPanel';
import { GuardPanel } from './components/guard/GuardPanel';
import './App.css';

function DashboardApp() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <SocketProvider>
              <DashboardLayout />
            </SocketProvider>
          </RequireAuth>
        }
      >
        <Route index element={<OperatorPanel />} />
        <Route
          path="admin"
          element={
            <RequireRole role="admin">
              <AdminPanel />
            </RequireRole>
          }
        />
        <Route
          path="guard"
          element={
            <RequireRole role={['admin', 'guard']}>
              <GuardPanel />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DashboardApp />
      </AuthProvider>
    </BrowserRouter>
  );
}
