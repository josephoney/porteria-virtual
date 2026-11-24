import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { RequireAuth, RequireRole, RequirePlatformAdmin } from './components/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { CommunityEntryPage } from './pages/CommunityEntryPage';
import { InvitePage } from './pages/InvitePage';
import { PlatformPage } from './pages/PlatformPage';
import { SectionsPage } from './pages/SectionsPage';
import { UnitsPage } from './pages/UnitsPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { OperatorPanel } from './components/operator/OperatorPanel';
import { AdminPanel } from './components/admin/AdminPanel';
import { AccessPointsPanel } from './components/admin/AccessPointsPanel';
import { MyOrganizationPage } from './pages/MyOrganizationPage';
import { GuardPanel } from './components/guard/GuardPanel';
import { ResidentHomePage } from './pages/ResidentHomePage';
import { ResidentAuthorizationsPage } from './pages/ResidentAuthorizationsPage';
import { ResidentAuthorizationNewPage } from './pages/ResidentAuthorizationNewPage';
import { ResidentAuthorizationBulkPage } from './pages/ResidentAuthorizationBulkPage';
import { ErrorBoundary } from './components/errors/ErrorBoundary';
import { Button } from './components/ui/button';
import './App.css';

function HomePage() {
  const { user, activeMembership } = useAuth();

  if (user?.isPlatformAdmin && activeMembership?.id === 'platform') {
    return <Navigate to="/platform" replace />;
  }

  if (activeMembership && ['owner', 'tenant', 'resident'].includes(activeMembership.role)) {
    return <Navigate to="/resident" replace />;
  }

  if (activeMembership && ['org_admin', 'community_admin'].includes(activeMembership.role)) {
    return <Navigate to="/admin" replace />;
  }

  if (activeMembership?.role === 'guard') {
    return <Navigate to="/guard" replace />;
  }

  return <OperatorPanel />;
}

function AppRequiredPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function goToLogin() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-5 text-center">
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Usa Zima QR Access</h1>
          <p className="text-sm text-muted-foreground">
            La app de residentes y guardias está disponible para Android e iOS. Desde el dashboard
            solo se administra la comunidad.
          </p>
        </div>
        {user && (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Sesión activa: <span className="font-medium text-foreground">{user.email}</span>
          </p>
        )}
        <Button type="button" className="w-full" onClick={goToLogin}>
          Cerrar sesión y usar otra cuenta
        </Button>
      </div>
    </div>
  );
}

function DashboardApp() {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary resetKey={pathname} fullPage>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/c/:slug" element={<CommunityEntryPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route
          path="/app-required"
          element={
            <RequireAuth>
              <AppRequiredPage />
            </RequireAuth>
          }
        />
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
          <Route index element={<HomePage />} />
          <Route
            path="platform"
            element={
              <RequirePlatformAdmin>
                <PlatformPage />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="platform/organizations"
            element={
              <RequirePlatformAdmin>
                <PlatformPage />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="platform/communities"
            element={
              <RequirePlatformAdmin>
                <PlatformPage />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="platform/sections"
            element={
              <RequirePlatformAdmin>
                <SectionsPage />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="platform/units"
            element={
              <RequirePlatformAdmin>
                <UnitsPage />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="platform/invitations"
            element={
              <RequirePlatformAdmin>
                <PlatformPage />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="platform/users"
            element={
              <RequirePlatformAdmin>
                <PlatformPage />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="platform/bitacora"
            element={
              <RequirePlatformAdmin>
                <AnalysisPage scope="platform" />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="platform/reports"
            element={
              <RequirePlatformAdmin>
                <AnalysisPage scope="platform" />
              </RequirePlatformAdmin>
            }
          />
          <Route
            path="platform/history"
            element={
              <RequirePlatformAdmin>
                <AnalysisPage scope="platform" />
              </RequirePlatformAdmin>
            }
          />
          <Route path="analysis" element={<Navigate to="/analysis/bitacora" replace />} />
          <Route
            path="analysis/bitacora-accesos"
            element={
              <RequireRole role={['org_admin', 'community_admin', 'operator', 'guard']}>
                <AnalysisPage />
              </RequireRole>
            }
          />
          <Route
            path="analysis/:section"
            element={
              <RequireRole role={['org_admin', 'community_admin', 'operator', 'guard']}>
                <AnalysisPage />
              </RequireRole>
            }
          />
          <Route
            path="admin"
            element={
              <RequireRole role={['org_admin', 'community_admin']}>
                <AdminPanel />
              </RequireRole>
            }
          />
          <Route
            path="admin/organization"
            element={
              <RequireRole role={['org_admin']}>
                <MyOrganizationPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/communities"
            element={
              <RequireRole role={['org_admin']}>
                <AdminPanel />
              </RequireRole>
            }
          />
          <Route
            path="admin/sections"
            element={
              <RequireRole role={['org_admin', 'community_admin']}>
                <SectionsPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/units"
            element={
              <RequireRole role={['org_admin', 'community_admin']}>
                <UnitsPage />
              </RequireRole>
            }
          />
          <Route
            path="admin/invitations"
            element={
              <RequireRole role={['org_admin', 'community_admin']}>
                <AdminPanel />
              </RequireRole>
            }
          />
          <Route
            path="admin/users"
            element={
              <RequireRole role={['org_admin', 'community_admin']}>
                <AdminPanel />
              </RequireRole>
            }
          />
          <Route
            path="admin/calls"
            element={
              <RequireRole role={['org_admin', 'community_admin']}>
                <AdminPanel />
              </RequireRole>
            }
          />
          <Route
            path="admin/access-points"
            element={
              <RequireRole role={['org_admin', 'community_admin']}>
                <AccessPointsPanel />
              </RequireRole>
            }
          />
          <Route
            path="resident"
            element={
              <RequireRole role={['owner', 'tenant', 'resident']}>
                <ResidentHomePage />
              </RequireRole>
            }
          />
          <Route
            path="resident/authorizations"
            element={
              <RequireRole role={['owner', 'tenant', 'resident']}>
                <ResidentAuthorizationsPage />
              </RequireRole>
            }
          />
          <Route
            path="resident/authorizations/new"
            element={
              <RequireRole role={['owner', 'tenant', 'resident']}>
                <ResidentAuthorizationNewPage />
              </RequireRole>
            }
          />
          <Route
            path="resident/authorizations/bulk"
            element={
              <RequireRole role={['owner', 'tenant', 'resident']}>
                <ResidentAuthorizationBulkPage />
              </RequireRole>
            }
          />
          <Route
            path="guard"
            element={
              <RequireRole role={['org_admin', 'guard']}>
                <GuardPanel />
              </RequireRole>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
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
