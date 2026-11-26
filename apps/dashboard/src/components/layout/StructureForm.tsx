import { useState } from 'react';
import { patch, post } from '../../lib/apiClient';
import { fieldA11y, hasErrors, requiredError } from '../../lib/form';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';

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
  const [communityId, setCommunityId] = useState(initial?.communityId ?? communities[0]?.id ?? '');
  const name = initial?.name ?? 'Estructura principal';
  const [levelCount, setLevelCount] = useState(initial?.levelCount ?? 3);
  const [level1Name, setLevel1Name] = useState(initial?.level1Name ?? 'Sección');
  const [level2Name, setLevel2Name] = useState(initial?.level2Name ?? 'Piso');
  const [level3Name, setLevel3Name] = useState(initial?.level3Name ?? 'Unidad');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    communityId?: string;
    level1Name?: string;
    level2Name?: string;
    level3Name?: string;
  }>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const validation = {
      communityId: requiredError(communityId, 'La comunidad'),
      level1Name: requiredError(level1Name, 'El nivel 1'),
      level2Name: levelCount >= 2 ? requiredError(level2Name, 'El nivel 2') : '',
      level3Name: levelCount >= 3 ? requiredError(level3Name, 'El nivel 3') : '',
    };
    setFieldErrors(validation);
    if (hasErrors(validation)) return;

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
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <Label htmlFor="structure-community">Comunidad</Label>
        <NativeSelect
          id="structure-community"
          value={communityId}
          onChange={(event) => {
            setCommunityId(event.target.value);
            setFieldErrors((current) => ({ ...current, communityId: undefined }));
          }}
          disabled={Boolean(initial)}
          required
          {...fieldA11y('structure-community', fieldErrors.communityId)}
        >
          <option value="">Elegir comunidad…</option>
          {communities.map((community) => (
            <option key={community.id} value={community.id}>
              {community.name}
            </option>
          ))}
        </NativeSelect>
        {fieldErrors.communityId && (
          <p id="structure-community-error" role="alert" className="text-xs text-destructive">
            {fieldErrors.communityId}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="structure-levels">Cantidad de niveles</Label>
        <NativeSelect
          id="structure-levels"
          value={levelCount}
          onChange={(event) => setLevelCount(Number(event.target.value))}
          aria-describedby="structure-levels-help"
        >
          <option value={1}>1 nivel</option>
          <option value={2}>2 niveles</option>
          <option value={3}>3 niveles</option>
        </NativeSelect>
        <p id="structure-levels-help" className="text-xs text-muted-foreground">
          El último nivel es la unidad. Para Torres → Apartamentos, usa 2 niveles.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="structure-level-1">Nivel 1</Label>
          <Input
            id="structure-level-1"
            value={level1Name}
            onChange={(event) => {
              setLevel1Name(event.target.value);
              setFieldErrors((current) => ({ ...current, level1Name: undefined }));
            }}
            required
            {...fieldA11y('structure-level-1', fieldErrors.level1Name)}
          />
          {fieldErrors.level1Name && (
            <p id="structure-level-1-error" role="alert" className="text-xs text-destructive">
              {fieldErrors.level1Name}
            </p>
          )}
        </div>
        {levelCount >= 2 && (
          <div className="space-y-1">
            <Label htmlFor="structure-level-2">Nivel 2</Label>
            <Input
              id="structure-level-2"
              value={level2Name}
              onChange={(event) => {
                setLevel2Name(event.target.value);
                setFieldErrors((current) => ({ ...current, level2Name: undefined }));
              }}
              required
              {...fieldA11y('structure-level-2', fieldErrors.level2Name)}
            />
            {fieldErrors.level2Name && (
              <p id="structure-level-2-error" role="alert" className="text-xs text-destructive">
                {fieldErrors.level2Name}
              </p>
            )}
          </div>
        )}
        {levelCount >= 3 && (
          <div className="space-y-1">
            <Label htmlFor="structure-level-3">Nivel 3</Label>
            <Input
              id="structure-level-3"
              value={level3Name}
              onChange={(event) => {
                setLevel3Name(event.target.value);
                setFieldErrors((current) => ({ ...current, level3Name: undefined }));
              }}
              required
              {...fieldA11y('structure-level-3', fieldErrors.level3Name)}
            />
            {fieldErrors.level3Name && (
              <p id="structure-level-3-error" role="alert" className="text-xs text-destructive">
                {fieldErrors.level3Name}
              </p>
            )}
          </div>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear estructura'}
      </Button>
    </form>
  );
}
