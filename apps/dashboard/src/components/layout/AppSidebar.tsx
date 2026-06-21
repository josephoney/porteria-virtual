import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '../ui/sidebar';
import { LayoutDashboard, ShieldCheck, Footprints } from 'lucide-react';

const items = [
  { to: '/', label: 'Operador', icon: LayoutDashboard, roles: ['admin', 'operator'] },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, roles: ['admin'] },
  { to: '/guard', label: 'Guardia', icon: Footprints, roles: ['admin', 'guard'] },
];

export function AppSidebar() {
  const { user } = useAuth();
  const location = useLocation();

  const filtered = items.filter((item) => user && item.roles.includes(user.role));

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filtered.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)}
                    tooltip={item.label}
                  >
                    <NavLink to={item.to} end={item.to === '/'}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] shrink-0">{user?.role}</Badge>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
