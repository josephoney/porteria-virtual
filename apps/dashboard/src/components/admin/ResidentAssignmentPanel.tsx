import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { get, post } from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface ResidentRow {
  id: string;
  personId: string;
  personName: string;
  personEmail: string | null;
  relationship: string;
  status: string;
}

const RELATIONSHIPS = ['owner', 'tenant', 'resident', 'family', 'staff'] as const;

const RELATIONSHIP_LABELS: Record<string, string> = {
  owner: 'Propietario',
  tenant: 'Inquilino',
  resident: 'Residente',
  family: 'Familiar',
  staff: 'Staff',
};

interface ResidentAssignmentPanelProps {
  unitId: string;
  unitName: string;
}

export function ResidentAssignmentPanel({ unitId, unitName }: ResidentAssignmentPanelProps) {
  const { user, activeMembership } = useAuth();
  const isPlatformContext = Boolean(user?.isPlatformAdmin && activeMembership?.id === 'platform');

  const [users, setUsers] = useState<UserOption[]>([]);
  const [residents, setResidents] = useState<ResidentRow[]>([]);
  const [residentUserId, setResidentUserId] = useState('');
  const [relationship, setRelationship] = useState<string>('resident');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [residentsResult, usersResult] = await Promise.all([
        get<ResidentRow[]>(`/api/units/${unitId}/residents`),
        user
          ? get<{ data: UserOption[] }>(
              isPlatformContext ? '/api/platform/users?pageSize=100' : '/api/users?pageSize=100',
            )
          : Promise.resolve(null),
      ]);
      setResidents(residentsResult.data);
      if (usersResult) setUsers(usersResult.data.data);
    } catch {
      setError('No se pudieron cargar los residentes de la unidad.');
    } finally {
      setLoading(false);
    }
  }, [unitId, user, isPlatformContext]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addResident(event: FormEvent) {
    event.preventDefault();
    if (!residentUserId) return;
    setSaving(true);
    setError('');
    try {
      await post(`/api/units/${unitId}/residents`, {
        userId: residentUserId,
        relationship,
      });
      setResidentUserId('');
      setRelationship('resident');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asociar el residente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Residentes de {unitName}</h3>
        <p className="text-sm text-muted-foreground">
          Personas asociadas a esta unidad y su relación.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : residents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay residentes asociados.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {residents.map((resident) => (
            <li key={resident.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{resident.personName}</p>
                <p className="text-xs text-muted-foreground">{resident.personEmail}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {RELATIONSHIP_LABELS[resident.relationship] ?? resident.relationship}
                </span>
                <span className="text-xs text-muted-foreground">{resident.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addResident} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="resident-user">Usuario</Label>
          <Select value={residentUserId} onValueChange={setResidentUserId}>
            <SelectTrigger id="resident-user" className="w-full" aria-label="Usuario a asociar">
              <SelectValue placeholder="Elige un usuario" />
            </SelectTrigger>
            <SelectContent>
              {users.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name} · {option.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="resident-relationship">Relación</Label>
          <Select value={relationship} onValueChange={setRelationship}>
            <SelectTrigger id="resident-relationship" className="w-full" aria-label="Relación">
              <SelectValue placeholder="Elige la relación" />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIPS.map((value) => (
                <SelectItem key={value} value={value}>
                  {RELATIONSHIP_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={saving || !residentUserId}>
          {saving ? 'Asociando…' : 'Asociar residente'}
        </Button>
      </form>
    </div>
  );
}
