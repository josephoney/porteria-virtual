import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';

export function DashboardLayout() {
  return (
    <div id="app">
      <TopBar />
      <div className="main">
        <Sidebar />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
