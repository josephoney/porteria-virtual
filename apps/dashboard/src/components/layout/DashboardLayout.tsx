import { Outlet, useLocation } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';
import { AppSidebar } from './AppSidebar';
import { IncomingCallOverlay } from './IncomingCallOverlay';
import { SidebarProvider, SidebarInset } from '../ui/sidebar';
import { TooltipProvider } from '../ui/tooltip';
import { WorkspaceProvider } from '../../contexts/WorkspaceContext';
import { WorkspaceWelcomeToast } from './WorkspaceWelcomeToast';
import { ErrorBoundary } from '../errors/ErrorBoundary';

export function DashboardLayout() {
  const { pathname } = useLocation();

  return (
    <TooltipProvider>
      <WorkspaceProvider>
        <SidebarProvider>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <SidebarInset className="flex flex-col flex-1 min-w-0">
              <IncomingCallOverlay />
              <WorkspaceWelcomeToast />
              <SiteHeader />
              <main className="flex-1 overflow-auto">
                <ErrorBoundary resetKey={pathname}>
                  <Outlet />
                </ErrorBoundary>
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </WorkspaceProvider>
    </TooltipProvider>
  );
}
