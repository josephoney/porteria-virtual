import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function DetailGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>{children}</dl>;
}

export function DetailField({
  label,
  value,
  span = 'half',
  className,
  valueClassName,
}: {
  label: string;
  value?: ReactNode;
  span?: 'half' | 'full';
  className?: string;
  valueClassName?: string;
}) {
  const isEmpty =
    value === null ||
    value === undefined ||
    value === '' ||
    (typeof value === 'string' && value.trim() === '');

  return (
    <div className={cn('min-w-0 space-y-1', span === 'full' && 'sm:col-span-2', className)}>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={cn('text-sm font-medium text-foreground break-words', valueClassName)}>
        {isEmpty ? '—' : value}
      </dd>
    </div>
  );
}
