import { useState } from 'react';
import { patch, post } from '../../lib/apiClient';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface CommunityOption {
  id: string;
  name: string;
}

export interface StructureInitial {
  id: string;
  communityId: string;
  name: string;
  levelCount: number;
  level1Name: string;
  level2Name: string | null;
  level3Name: string | null;
}

export function StructureForm({
  communities,
  onSaved,
  initial,
}: {
  communities: CommunityOption[];
  onSaved: () => void;
  initial?: StructureInitial;
}) {
  const [communityId, setCommunityId] = useState(
    initial?.communityId ?? communities[0]?.id ?? '',
  );
  const [name, setName] = useState(initial?.name ?? 'Estructura principal');
  const [levelCount, setLevelCount] = useState(initial?.levelCount ?? 3);
  const [level1Name, setLevel1Name] = useState(initial?.level1Name ?? 'Sección');
  const [level2Name, setLevel2Name] = useState(initial?.level2Name ?? 'Piso');
  const [level3Name, setLevel3Name] = useState(initial?.level3Name ?? 'Unidad');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        communityId,
        name,
        levelCount,
        level1Name,
        level2Name: levelCount >= 2 ? level2Name : null,
        level3Name: levelCount >= 3 ? level3Name : null,
      };
      if (initial) {
        await patch(`/api/location-structures/${initial.id}`, body);
      } else {
        await post('/api/location-structures', body);
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `No se pudo ${initial ? 'actualizar' : 'crear'} la estructura.`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="structure-community">Comunidad</Label>
        <select
          id="structure-community"
          className="h-9 w-full rounded border border-border bg-card px-2 text-sm disabled:opacity-60"
          value={communityId}
          onChange={(event) => setCommunityId(event.target.value)}
          disabled={Boolean(initial)}
          required
        >
          <option value="">Elegir comunidad…</option>
          {communities.map((community) => (
            <option key={community.id} value={community.id}>
              {community.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="structure-name">Nombre</Label>
        <Input
          id="structure-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="structure-levels">Cantidad de niveles</Label>
        <select
          id="structure-levels"
          className="h-9 w-full rounded border border-border bg-card px-2 text-sm"
          value={levelCount}
          onChange={(event) => setLevelCount(Number(event.target.value))}
        >
          <option value={1}>1 nivel</option>
          <option value={2}>2 niveles</option>
          <option value={3}>3 niveles</option>
        </select>
        <p className="text-xs text-muted-foreground">
          El último nivel es la unidad. Para Torres → Apartamentos, usá 2 niveles.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="structure-level-1">Nivel 1</Label>
          <Input
            id="structure-level-1"
            value={level1Name}
            onChange={(event) => setLevel1Name(event.target.value)}
            required
          />
        </div>
        {levelCount >= 2 && (
          <div className="space-y-1">
            <Label htmlFor="structure-level-2">Nivel 2</Label>
            <Input
              id="structure-level-2"
              value={level2Name}
              onChange={(event) => setLevel2Name(event.target.value)}
              required
            />
          </div>
        )}
        {levelCount >= 3 && (
          <div className="space-y-1">
            <Label htmlFor="structure-level-3">Nivel 3</Label>
            <Input
              id="structure-level-3"
              value={level3Name}
              onChange={(event) => setLevel3Name(event.target.value)}
              required
            />
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving || !communityId}>
        {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear estructura'}
      </Button>
    </form>
  );
}
