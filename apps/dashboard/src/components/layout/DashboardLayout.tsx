import { Outlet } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';
import { AppSidebar } from './AppSidebar';
import { IncomingCallOverlay } from './IncomingCallOverlay';
import { SidebarProvider, SidebarInset } from '../ui/sidebar';
import { TooltipProvider } from '../ui/tooltip';

export function DashboardLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex flex-col flex-1 min-w-0">
            <IncomingCallOverlay />
            <SiteHeader />
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
