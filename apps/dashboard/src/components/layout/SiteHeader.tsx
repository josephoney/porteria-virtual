import { Link, useLocation } from 'react-router-dom';
import { SidebarTrigger } from '../ui/sidebar';
import { Separator } from '../ui/separator';

const labels: Record<string, string> = {
  platform: 'Plataforma',
  organizations: 'Organizaciones',
  communities: 'Comunidades',
  sections: 'Secciones',
  units: 'Unidades',
  invitations: 'Invitaciones',
  users: 'Usuarios',
  admin: 'Administración',
  resident: 'Mi cuenta',
  authorizations: 'Autorizaciones',
  new: 'Nueva',
  bulk: 'Carga masiva',
  analysis: 'Análisis',
  bitacora: 'Bitácora',
  reports: 'Reportes',
  history: 'Historial',
  guard: 'Guardia',
};

function crumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [{ label: 'Operador', to: '/' }];

  return segments.map((segment, index) => ({
    label: labels[segment] ?? segment,
    to: `/${segments.slice(0, index + 1).join('/')}`,
  }));
}

export function SiteHeader() {
  const { pathname } = useLocation();
  const items = crumbs(pathname);

  return (
    <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border px-4">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
          style={{ alignSelf: 'center', height: '1rem' }}
        />
        <nav aria-label="breadcrumb" className="min-w-0 truncate">
          <ol className="flex items-center gap-2 text-sm">
            {items.map((item, index) => {
              const isLast = index === items.length - 1;
              return (
                <li key={item.to} className="flex items-center gap-2">
                  {isLast ? (
                    <span className="font-medium text-foreground">{item.label}</span>
                  ) : (
                    <>
                      <Link
                        to={item.to}
                        className="hidden text-muted-foreground transition-colors hover:text-foreground md:inline"
                      >
                        {item.label}
                      </Link>
                      <span className="hidden text-muted-foreground md:inline">/</span>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* Product identity. The logo already carries the "Zima" wordmark, so it is
          the whole brand mark. The third grid track stays empty on purpose: both
          `1fr` tracks are what keep the logo centered regardless of breadcrumb width. */}
      <div className="flex items-center justify-center">
        <img src="/brand/logo-zima-b.svg" alt="Zima" className="h-9 w-auto dark:hidden sm:h-10" />
        <img
          src="/brand/logo-zima-w.svg"
          alt="Zima"
          className="hidden h-9 w-auto dark:block sm:h-10"
        />
      </div>
    </header>
  );
}
