import { useCallback, useEffect, useState } from 'react';
import { ApiError, get, put } from '../../lib/apiClient';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';

interface GuardRow {
  membershipId: string;
  personName: string;
  email: string | null;
  onShift: boolean;
  shiftId: string | null;
}

interface MembershipRow {
  id: string;
  role: string;
  communityId: string | null;
  defaultAccessPointId?: string | null;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  memberships: MembershipRow[];
}

interface GuardCandidate {
  membershipId: string;
  label: string;
  accessPointId: string | null;
}

interface AccessPointGuardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string | null;
  accessPointId: string | null;
  accessPointName: string;
  onChanged: () => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'No se pudieron cargar los guardias del acceso.';
}

export function AccessPointGuardsDialog({
  open,
  onOpenChange,
  communityId,
  accessPointId,
  accessPointName,
  onChanged,
}: AccessPointGuardsDialogProps) {
  const [guards, setGuards] = useState<GuardRow[]>([]);
  const [candidates, setCandidates] = useState<GuardCandidate[]>([]);
  const [selected, setSelected] = useState('none');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!communityId || !accessPointId) return;
    setLoading(true);
    setError(null);
    try {
      const [guardsResult, usersResult] = await Promise.all([
        get<{ items: GuardRow[] }>(
          `/api/communities/${communityId}/access-points/${accessPointId}/guards`,
        ),
        get<{ data: UserRow[] }>('/api/users?pageSize=100'),
      ]);

      setGuards(guardsResult.data.items);

      const next: GuardCandidate[] = [];
      for (const user of usersResult.data.data) {
        const membership = user.memberships.find(
          (item) => item.role === 'guard' && item.communityId === communityId,
        );
        if (!membership) continue;
        next.push({
          membershipId: membership.id,
          label: `${user.name} · ${user.email}`,
          accessPointId: membership.defaultAccessPointId ?? null,
        });
      }
      setCandidates(next);
    } catch (err) {
      setError(errorMessage(err));
      setGuards([]);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [communityId, accessPointId]);

  useEffect(() => {
    if (!open) return;
    setSelected('none');
    void load();
  }, [open, load]);

  async function assign() {
    if (selected === 'none') return;
    setSaving(true);
    setError(null);
    try {
      await put(`/api/memberships/${selected}/workstation`, { accessPointId });
      setSelected('none');
      await load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guardias de {accessPointName}</DialogTitle>
          <DialogDescription>
            Quiénes tienen este acceso como puesto por defecto y quiénes están en turno ahora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : guards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ningún guardia tiene este acceso como puesto por defecto.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {guards.map((guard) => (
                <li
                  key={guard.membershipId}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{guard.personName}</p>
                    {guard.email && (
                      <p className="text-xs text-muted-foreground">{guard.email}</p>
                    )}
                  </div>
                  <Badge variant={guard.onShift ? 'default' : 'secondary'}>
                    {guard.onShift ? 'En turno' : 'Fuera de turno'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1">
            <Label htmlFor="assign-guard">Asignar un guardia a este acceso</Label>
            <div className="flex gap-2">
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger id="assign-guard" className="w-full">
                  <SelectValue placeholder="Elige un guardia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Elige un guardia</SelectItem>
                  {candidates.map((candidate) => (
                    <SelectItem key={candidate.membershipId} value={candidate.membershipId}>
                      {candidate.label}
                      {candidate.accessPointId === accessPointId ? ' (ya asignado)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={assign}
                disabled={saving || selected === 'none'}
              >
                {saving ? 'Asignando…' : 'Asignar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              El puesto es un valor por defecto: no impide que el guardia cubra otro acceso activo.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
