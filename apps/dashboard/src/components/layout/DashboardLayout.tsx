import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { AppSidebar } from './AppSidebar';
import { IncomingCallOverlay } from './IncomingCallOverlay';
import { SidebarProvider, SidebarInset } from '../ui/sidebar';

export function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 min-w-0">
          <IncomingCallOverlay />
          <TopBar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
