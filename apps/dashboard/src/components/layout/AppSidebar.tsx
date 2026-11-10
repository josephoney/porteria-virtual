import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { assetObjectUrl, get } from '../../lib/apiClient';
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
  RiBarChart2Line,
  RiBookOpenLine,
  RiBox3Line,
  RiBuilding2Line,
  RiDoorOpenLine,
  RiFootprintLine,
  RiHistoryLine,
  RiGovernmentLine,
  RiStackLine,
  RiDashboardLine,
  RiMailLine,
  RiGroupLine,
  type RemixiconComponentType,
} from '@remixicon/react';

interface NavItem {
  to: string;
  label: string;
  icon: RemixiconComponentType;
  roles: string[];
  platformOnly?: boolean;
  group: 'operation' | 'admin' | 'analysis';
}

const items: NavItem[] = [
  // Operación (tenant)
  {
    to: '/',
    label: 'Operador',
    icon: RiDashboardLine,
    roles: ['org_admin', 'community_admin', 'operator'],
    group: 'operation',
  },
  {
    to: '/guard',
    label: 'Guardia',
    icon: RiFootprintLine,
    roles: ['org_admin', 'guard'],
    group: 'operation',
  },

  // Administración de plataforma
  {
    to: '/platform',
    label: 'Resumen',
    icon: RiDashboardLine,
    roles: [],
    platformOnly: true,
    group: 'admin',
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
    label: 'Secciones',
    icon: RiStackLine,
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
    label: 'Secciones',
    icon: RiStackLine,
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

  // Análisis
  {
    to: '/platform/bitacora',
    label: 'Auditoría',
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
    roles: ['org_admin', 'community_admin'],
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
};

export function AppSidebar() {
  const { user, activeMembership } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const [brandLogo, setBrandLogo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadBrand() {
      try {
        let logoAssetId: string | null = null;
        if (user?.isPlatformAdmin && activeMembership?.id === 'platform') return;
        if (activeMembership?.role === 'org_admin') {
          const result = await get<{ logoAssetId: string | null }>('/api/organizations/me');
          logoAssetId = result.data.logoAssetId;
        } else if (activeMembership?.communityId) {
          const result = await get<{ community: { logoAssetId: string | null } }>(
            `/api/communities/${activeMembership.communityId}/overview`,
          );
          logoAssetId = result.data.community.logoAssetId;
        }

        if (!logoAssetId || cancelled) return;
        objectUrl = await assetObjectUrl(logoAssetId);
        if (!cancelled) setBrandLogo(objectUrl);
      } catch {
        // Keep the default platform icon.
      }
    }

    setBrandLogo(null);
    loadBrand();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    user?.isPlatformAdmin,
    activeMembership?.id,
    activeMembership?.role,
    activeMembership?.communityId,
  ]);
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  const role = activeMembership?.role ?? '';
  const isPlatformContext = Boolean(user?.isPlatformAdmin && activeMembership?.id === 'platform');
  const groupOrder: NavItem['group'][] = isPlatformContext
    ? ['admin', 'analysis']
    : ['org_admin', 'community_admin'].includes(role)
      ? ['admin', 'operation', 'analysis']
      : ['operation', 'analysis'];

  const visible = items.filter((item) => {
    if (!user) return false;
    if (item.platformOnly) return user.isPlatformAdmin;
    if (isPlatformContext) return false;
    return item.roles.includes(role);
  });

  const isActive = (to: string) =>
    to === '/' || to === '/platform' || to === '/admin'
      ? location.pathname === to
      : location.pathname.startsWith(to);

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <NavLink to="/" onClick={closeMobile}>
                {brandLogo ? (
                  <img
                    src={brandLogo}
                    alt="Logo de la organización"
                    className="size-7 rounded-md object-cover"
                  />
                ) : (
                  <RiBuilding2Line className="size-5" />
                )}
                <span className="font-heading text-base font-semibold">Portería Virtual</span>
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
                      <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                        <NavLink to={item.to} end={item.to === '/'} onClick={closeMobile}>
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
