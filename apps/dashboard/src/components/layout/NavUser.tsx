import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiCheckLine,
  RiLogoutBoxLine,
  RiMoonLine,
  RiNotificationLine,
  RiMoreLine,
  RiUserLine,
} from '@remixicon/react';
import { useAuth } from '../../contexts/AuthContext';
import { applyTheme, getInitialTheme, type Theme } from '../../lib/theme';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '../ui/sidebar';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function membershipLabel(membership: {
  role: string;
  communityId: string | null;
  organizationId: string;
}): string {
  const scope = membership.communityId ?? membership.organizationId;
  return `${membership.role} · ${scope.slice(0, 8)}`;
}

export function NavUser() {
  const { user, memberships, activeMembership, switchContext, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  if (!user) return null;

  const isDark = theme === 'dark';
  const activeContext = activeMembership
    ? membershipLabel(activeMembership)
    : 'Sin contexto activo';

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
        <DropdownMenu>
          <SidebarMenuButton asChild size="lg" className="data-[state=open]:bg-sidebar-accent">
            <DropdownMenuTrigger className="flex w-full items-center gap-2">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <RiMoreLine className="ml-auto size-4" />
            </DropdownMenuTrigger>
          </SidebarMenuButton>
            <DropdownMenuContent
              side="right"
              align="end"
              sideOffset={4}
              className="w-64 rounded-xl"
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {activeContext}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Contexto</DropdownMenuLabel>
                {memberships.map((membership) => (
                  <DropdownMenuItem
                    key={membership.id}
                    onSelect={() => {
                      switchContext(membership.id).catch(() => {});
                    }}
                  >
                    <RiCheckLine
                      className={
                        membership.id === activeMembership?.id
                          ? 'size-4 opacity-100'
                          : 'size-4 opacity-0'
                      }
                    />
                    {membershipLabel(membership)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={isDark}
                onCheckedChange={() => setTheme(isDark ? 'light' : 'dark')}
              >
                <RiMoonLine className="size-4" />
                Tema oscuro
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setAccountOpen(true)}>
                <RiUserLine className="size-4" />
                Cuenta
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setNotificationsOpen(true)}>
                <RiNotificationLine className="size-4" />
                Notificaciones
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  logout();
                  navigate('/login');
                }}
              >
                <RiLogoutBoxLine className="size-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cuenta</DialogTitle>
            <DialogDescription>
              Información de la cuenta y del contexto activo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 rounded-xl">
              <AvatarFallback className="rounded-xl text-base">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border p-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Contexto activo</p>
            <p className="mt-1">{activeContext}</p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificaciones</DialogTitle>
            <DialogDescription>
              Avisos de accesos, llamadas y cambios de contexto.
            </DialogDescription>
          </DialogHeader>
          <p className="py-6 text-center text-sm text-muted-foreground">
            No tenés notificaciones pendientes.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
