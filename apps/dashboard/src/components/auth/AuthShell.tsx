import type { ReactNode } from 'react';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[55fr_45fr]">
      <h1 className="sr-only">Zima Seguridad</h1>

      <section className="relative hidden overflow-hidden bg-primary lg:block">
        <img
          src="/brand/fondo_contacto.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="relative flex h-full flex-col items-start justify-center gap-6 p-10 text-left text-primary-foreground">
          <img src="/brand/LogoZima_W.svg" alt="Zima Seguridad" className="h-24 w-auto" />
          <p className="text-lg text-primary-foreground/80">Sistema Portería virtual y accesos</p>
        </div>
      </section>

      <section className="flex min-h-svh flex-col">
        <div className="relative flex h-44 items-center justify-start overflow-hidden bg-primary p-6 lg:hidden">
          <img
            src="/brand/fondo_contacto.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="relative flex flex-col items-start gap-2 text-left text-primary-foreground">
            <img src="/brand/LogoZima_W.svg" alt="Zima Seguridad" className="h-12 w-auto" />
            <p className="text-xs text-primary-foreground/80">Sistema Portería virtual y accesos</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </section>
    </div>
  );
}
