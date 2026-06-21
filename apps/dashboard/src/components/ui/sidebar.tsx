import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Sheet, SheetContent } from './sheet';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './tooltip';
import { PanelLeft } from 'lucide-react';

const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_COLLAPSED_WIDTH = '3rem';

type SidebarContext = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
};

const SidebarContext = React.createContext<SidebarContext | null>(null);

function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  children,
}: {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [openMobile, setOpenMobile] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen: React.Dispatch<React.SetStateAction<boolean>> = React.useCallback(
    (v) => { _setOpen(v); if (typeof v === 'boolean') onOpenChange?.(v); },
    [onOpenChange],
  );

  return (
    <SidebarContext.Provider value={{ open: isMobile ? false : open, setOpen, openMobile, setOpenMobile, isMobile }}>
      <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
    </SidebarContext.Provider>
  );
}

function SidebarTrigger({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { setOpenMobile, setOpen, isMobile } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-9 w-9', className)}
      onClick={() => (isMobile ? setOpenMobile(true) : setOpen((prev) => !prev))}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
    </Button>
  );
}

function SidebarInset({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-1 flex-col overflow-hidden', className)} {...props} />;
}

function Sidebar({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open, openMobile, setOpenMobile, isMobile } = useSidebar();

  const sidebar = (
    <div
      data-sidebar="sidebar"
      className={cn(
        'flex flex-col h-screen shrink-0 bg-card border-r border-border transition-[width] duration-200 ease-in-out',
        open ? 'w-[var(--sidebar-width)]' : 'w-[var(--sidebar-collapsed)]',
        className,
      )}
      style={{ '--sidebar-width': SIDEBAR_WIDTH, '--sidebar-collapsed': SIDEBAR_COLLAPSED_WIDTH } as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side="left" className="w-[var(--sidebar-width)] p-0">
          {sidebar}
        </SheetContent>
      </Sheet>
    );
  }

  return sidebar;
}

function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-auto', className)} {...props} />;
}

function SidebarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-3 py-2', className)} {...props} />;
}

function SidebarGroupLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = useSidebar();
  if (!open) return null;
  return <div className={cn('px-2 py-1.5 text-xs font-bold tracking-widest uppercase text-muted-foreground', className)} {...props} />;
}

function SidebarGroupContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1', className)} {...props} />;
}

function SidebarMenu({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1', className)} {...props} />;
}

function SidebarMenuItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props} />;
}

function SidebarMenuButton({
  asChild,
  isActive,
  className,
  children,
  tooltip,
  ...props
}: React.ComponentProps<typeof Button> & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
}) {
  const { open } = useSidebar();
  const Comp = asChild ? Slot : 'button';

  const btn = (
    <Comp
      data-active={isActive}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-foreground data-[active=true]:text-background [&_span]:truncate',
        !open && 'justify-center px-0 [&_span]:hidden',
        className,
      )}
      {...(props as any)}
    >
      {children}
    </Comp>
  );

  if (!open && tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right">{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return btn;
}

function SidebarFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-t border-border p-3', className)} {...props} />;
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
};
