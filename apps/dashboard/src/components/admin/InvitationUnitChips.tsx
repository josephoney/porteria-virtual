import { Badge } from '../ui/badge';

export interface InvitationUnitChip {
  id: string;
  code: string;
  path: string;
}

interface InvitationUnitChipsProps {
  units: InvitationUnitChip[];
}

/** Small, non-interactive list of the units covered by an invitation. */
export function InvitationUnitChips({ units }: InvitationUnitChipsProps) {
  if (units.length === 0) return <span className="text-sm text-muted-foreground">—</span>;

  return (
    <div className="flex max-w-72 flex-wrap gap-1">
      {units.map((unit) => (
        <Badge key={unit.id} variant="secondary" title={unit.path}>
          {unit.code}
        </Badge>
      ))}
    </div>
  );
}
