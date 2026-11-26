import { cn } from '@/lib/utils';

interface LoadingStateProps {
  /** Qué se está cargando, por ejemplo "Cargando invitaciones…". */
  label?: string;
  className?: string;
}

/**
 * Espera explícita: un spinner con el nombre de lo que se está cargando.
 * La clase `loading-state` retrasa la aparición (ver index.css) para que una
 * respuesta rápida no produzca un destello, y reserva la altura para que el
 * contenido no salte al llegar.
 */
function LoadingState({ label = 'Cargando…', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'loading-state flex min-h-[240px] w-full flex-col items-center justify-center gap-3',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary"
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export { LoadingState };
