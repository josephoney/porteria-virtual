import { type ReactNode } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  triggerLabel,
  children,
  hidden = false,
  hideTrigger = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  triggerLabel?: string;
  children: ReactNode;
  hidden?: boolean;
  hideTrigger?: boolean;
}) {
  if (hidden) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!hideTrigger && triggerLabel && (
        <div className="flex justify-end">
          <DialogTrigger asChild>
            <Button>{triggerLabel}</Button>
          </DialogTrigger>
        </div>
      )}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
