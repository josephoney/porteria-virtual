import { RiUserAddLine } from '@remixicon/react';
import { Button } from '../ui/button';

interface UnitInviteSelectionBarProps {
  count: number;
  onInvite: () => void;
  onClear: () => void;
}

/**
 * Barra flotante compartida por el listado y el árbol de unidades. Aparece
 * cuando hay selección y evita repetir la misma acción en dos lugares.
 */
export function UnitInviteSelectionBar({ count, onInvite, onClear }: UnitInviteSelectionBarProps) {
  const unitLabel = count === 1 ? 'unidad' : 'unidades';

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 shadow-lg backdrop-blur">
        <span className="text-sm text-muted-foreground">
          {count} {unitLabel} seleccionada{count === 1 ? '' : 's'}
        </span>
        <Button type="button" size="sm" onClick={onInvite}>
          <RiUserAddLine className="size-4" aria-hidden="true" />
          Invitar a {count} {unitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Limpiar
        </Button>
      </div>
    </div>
  );
}
