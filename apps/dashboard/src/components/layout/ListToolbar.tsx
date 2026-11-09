import { type ReactNode } from 'react';
import { RiSearchLine } from '@remixicon/react';
import { Input } from '../ui/input';

export function ListToolbar({
  search,
  onSearchChange,
  placeholder = 'Buscar…',
  children,
  actions,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative w-full sm:w-64">
        <RiSearchLine className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="pl-8"
          aria-label={placeholder}
        />
      </div>
      {children}
      {actions && <div className="ml-auto">{actions}</div>}
    </div>
  );
}
