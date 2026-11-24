import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { NavUser } from './NavUser';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '../ui/sidebar';
import {
  RiAddLine,
  RiBarChart2Line,
  RiBookOpenLine,
  RiBox3Line,
  RiBuilding2Line,
  RiDoorOpenLine,
  RiFootprintLine,
  RiHistoryLine,
  RiGovernmentLine,
  RiHome5Line,
  RiDashboardLine,
  RiMailLine,
  RiNodeTree,
  RiQrCodeLine,
  RiGroupLine,
  type RemixiconComponentType,
} from '@remixicon/react';

interface NavItem {
  to: string;
  label: string;
  icon: RemixiconComponentType;
  roles: string[];
  platformOnly?: boolean;
  group: 'operation' | 'admin' | 'analysis' | 'resident';
  /** Landing route: active only on an exact path match, never on its subroutes. */
  end?: boolean;
}

const items: NavItem[] = [
  // Operación (tenant)
  {
    to: '/',
    label: 'Operador',
    icon: RiDashboardLine,
    roles: ['org_admin', 'community_admin', 'operator'],
    group: 'operation',
    end: true,
  },
  {
    to: '/guard',
    label: 'Guardia',
    icon: RiFootprintLine,
    roles: ['org_admin', 'guard'],
    group: 'operation',
    end: true,
  },

  // Administración de plataforma
  {
    to: '/platform',
    label: 'Resumen',
    icon: RiDashboardLine,
    roles: [],
    platformOnly: true,
    group: 'admin',
    end: true,
  },
  {
    to: '/platform/organizations',
    label: 'Organizaciones',
    icon: RiGovernmentLine,
    roles: [],
    platformOnly: true,
    group: 'admin',
  },
  {
    to: '/platform/communities',
    label: 'Comunidades',
    icon: RiBuilding2Line,
    roles: [],
    platformOnly: true,
    group: 'admin',
  },
  {
    to: '/platform/sections',
    label: 'Estructura',
    icon: RiNodeTree,
    roles: [],
    platformOnly: true,
    group: 'admin',
  },
  {
    to: '/platform/units',
    label: 'Unidades',
    icon: RiBox3Line,
    roles: [],
    platformOnly: true,
    group: 'admin',
  },
  {
    to: '/platform/invitations',
    label: 'Invitaciones',
    icon: RiMailLine,
    roles: [],
    platformOnly: true,
    group: 'admin',
  },
  {
    to: '/platform/users',
    label: 'Usuarios',
    icon: RiGroupLine,
    roles: [],
    platformOnly: true,
    group: 'admin',
  },

  // Administración tenant
  {
    to: '/admin',
    label: 'Resumen',
    icon: RiDashboardLine,
    roles: ['org_admin', 'community_admin'],
    group: 'admin',
    end: true,
  },
  {
    to: '/admin/organization',
    label: 'Mi Organización',
    icon: RiBuilding2Line,
    roles: ['org_admin'],
    group: 'admin',
  },
  {
    to: '/admin/communities',
    label: 'Comunidades',
    icon: RiBuilding2Line,
    roles: ['org_admin'],
    group: 'admin',
  },
  {
    to: '/admin/sections',
    label: 'Estructura',
    icon: RiNodeTree,
    roles: ['org_admin', 'community_admin'],
    group: 'admin',
  },
  {
    to: '/admin/units',
    label: 'Unidades',
    icon: RiBox3Line,
    roles: ['org_admin', 'community_admin'],
    group: 'admin',
  },
  {
    to: '/admin/invitations',
    label: 'Invitaciones',
    icon: RiMailLine,
    roles: ['org_admin', 'community_admin'],
    group: 'admin',
  },
  {
    to: '/admin/users',
    label: 'Usuarios',
    icon: RiGroupLine,
    roles: ['org_admin', 'community_admin'],
    group: 'admin',
  },
  {
    to: '/admin/access-points',
    label: 'Accesos',
    icon: RiDoorOpenLine,
    roles: ['org_admin', 'community_admin'],
    group: 'admin',
  },

  // Residente
  {
    to: '/resident',
    label: 'Inicio',
    icon: RiHome5Line,
    roles: ['owner', 'tenant', 'resident'],
    group: 'resident',
    end: true,
  },
  {
    to: '/resident/authorizations',
    label: 'Autorizaciones',
    icon: RiQrCodeLine,
    roles: ['owner', 'tenant', 'resident'],
    group: 'resident',
    end: true,
  },
  {
    to: '/resident/authorizations/new',
    label: 'Autorizar',
    icon: RiAddLine,
    roles: ['owner', 'tenant', 'resident'],
    group: 'resident',
  },

  // Análisis
  {
    to: '/platform/bitacora',
    label: 'Bitácora de accesos',
    icon: RiBookOpenLine,
    roles: [],
    platformOnly: true,
    group: 'analysis',
  },
  {
    to: '/platform/reports',
    label: 'Reportes',
    icon: RiBarChart2Line,
    roles: [],
    platformOnly: true,
    group: 'analysis',
  },
  {
    to: '/platform/history',
    label: 'Historial',
    icon: RiHistoryLine,
    roles: [],
    platformOnly: true,
    group: 'analysis',
  },
  {
    to: '/analysis/bitacora-accesos',
    label: 'Bitácora de accesos',
    icon: RiBookOpenLine,
    roles: ['org_admin', 'community_admin', 'operator', 'guard'],
    group: 'analysis',
  },
  {
    to: '/analysis/bitacora',
    label: 'Auditoría',
    icon: RiBookOpenLine,
    roles: ['org_admin', 'community_admin', 'operator', 'guard'],
    group: 'analysis',
  },
  {
    to: '/analysis/reports',
    label: 'Reportes',
    icon: RiBarChart2Line,
    roles: ['org_admin', 'community_admin', 'operator', 'guard'],
    group: 'analysis',
  },
];

const groupLabels: Record<NavItem['group'], string> = {
  operation: 'Operación',
  admin: 'Administración',
  analysis: 'Análisis',
  resident: 'Mi cuenta',
};

export function AppSidebar() {
  const { user, activeMembership } = useAuth();
  const workspace = useWorkspace();
  const { isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  const role = activeMembership?.role ?? '';
  const isPlatformContext = Boolean(user?.isPlatformAdmin && activeMembership?.id === 'platform');
  const groupOrder: NavItem['group'][] = isPlatformContext
    ? ['admin', 'analysis']
    : ['org_admin', 'community_admin'].includes(role)
      ? ['admin', 'operation', 'analysis']
      : ['owner', 'tenant', 'resident'].includes(role)
        ? ['resident']
        : ['operation', 'analysis'];

  const visible = items.filter((item) => {
    if (!user) return false;
    if (item.platformOnly) return user.isPlatformAdmin;
    if (isPlatformContext) return false;
    return item.roles.includes(role);
  });

  const isActive = (to: string, end?: boolean) =>
    end
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <NavLink to="/" onClick={closeMobile}>
                {workspace.logoUrl ? (
                  <img
                    src={workspace.logoUrl}
                    alt={`Logo de ${workspace.name}`}
                    className="size-7 rounded-md object-contain"
                  />
                ) : workspace.kind === 'platform' ? (
                  <RiGovernmentLine className="size-5" />
                ) : (
                  <RiBuilding2Line className="size-5" />
                )}
                <span
                  className="truncate font-heading text-base font-semibold"
                  title={workspace.name}
                >
                  {workspace.name}
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groupOrder.map((group) => {
          const groupItems = visible.filter((item) => item.group === group);
          if (groupItems.length === 0) return null;

          return (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{groupLabels[group]}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {groupItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.to, item.end)}
                        tooltip={item.label}
                      >
                        <NavLink to={item.to} end={item.end} onClick={closeMobile}>
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
