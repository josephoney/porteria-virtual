import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, get, post } from '../../lib/apiClient';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';

interface CommunityOption {
  id: string;
  name: string;
}

interface StructureRow {
  id: string;
  communityId: string;
  name: string;
  levelCount: number;
  level1Name: string | null;
  level2Name: string | null;
  level3Name: string | null;
}

interface NodeRow {
  id: string;
  communityId: string;
  parentId: string | null;
  levelPosition: number;
  name: string;
  status: string;
}

interface CreateUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communities: CommunityOption[];
  defaultCommunityId?: string | null;
  onCreated: () => void;
}

function levelName(structure: StructureRow, position: number): string {
  if (position === 1) return structure.level1Name ?? 'Sección';
  if (position === 2) return structure.level2Name ?? 'Nivel 2';
  return structure.level3Name ?? 'Nivel 3';
}

export function CreateUnitDialog({
  open,
  onOpenChange,
  communities,
  defaultCommunityId,
  onCreated,
}: CreateUnitDialogProps) {
  const [communityId, setCommunityId] = useState(defaultCommunityId ?? '');
  const [structure, setStructure] = useState<StructureRow | null>(null);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCommunityId(defaultCommunityId ?? communities[0]?.id ?? '');
    setSelections({});
    setName('');
    setCode('');
    setError(null);
    setFieldError(null);
  }, [open, defaultCommunityId, communities]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [structures, nodeList] = await Promise.all([
        get<StructureRow[]>(`/api/location-structures?communityId=${id}`),
        get<NodeRow[]>(`/api/location-units?communityId=${id}`),
      ]);
      setStructure(structures.data[0] ?? null);
      setNodes(nodeList.data);
    } catch (err) {
      setStructure(null);
      setNodes([]);
      setError(
        err instanceof ApiError ? err.message : 'No se pudo cargar la estructura de la comunidad.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !communityId) return;
    setSelections({});
    void load(communityId);
  }, [open, communityId, load]);

  const levelCount = structure?.levelCount ?? 0;
  const parentLevels = useMemo(
    () => (levelCount > 1 ? Array.from({ length: levelCount - 1 }, (_, index) => index + 1) : []),
    [levelCount],
  );

  function optionsFor(position: number): NodeRow[] {
    const parentId = position === 1 ? null : selections[position - 1];
    return nodes
      .filter(
        (node) =>
          node.levelPosition === position &&
          node.status === 'active' &&
          (position === 1 || node.parentId === parentId),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function selectParent(position: number, value: string) {
    setSelections((current) => {
      const next: Record<number, string> = { ...current, [position]: value };
      for (const key of Object.keys(next)) {
        if (Number(key) > position) delete next[Number(key)];
      }
      return next;
    });
    setError(null);
  }

  const parentsComplete = parentLevels.every((position) => Boolean(selections[position]));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!structure) return;
    if (!name.trim()) {
      setFieldError('El nombre es obligatorio.');
      return;
    }
    setFieldError(null);
    setError(null);
    setSaving(true);
    try {
      const parentId = levelCount > 1 ? selections[levelCount - 1] : undefined;
      await post('/api/location-units', {
        communityId,
        ...(parentId ? { parentId } : { structureId: structure.id }),
        name: name.trim(),
        code: code.trim() || null,
      });
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la unidad.');
    } finally {
      setSaving(false);
    }
  }

  const blockedMessage = !structure
    ? 'Esta comunidad todavía no tiene estructura. Defínela en Estructura antes de crear unidades.'
    : parentLevels.length > 0 && !parentsComplete
      ? 'Elige la ruta completa hasta la unidad.'
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva unidad</DialogTitle>
          <DialogDescription>
            Se crea en el último nivel de la estructura de la comunidad. Para crear secciones
            o niveles intermedios, usa Estructura → Esquema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="space-y-1">
            <Label htmlFor="unit-community">Comunidad</Label>
            <Select value={communityId} onValueChange={setCommunityId}>
              <SelectTrigger id="unit-community" className="w-full">
                <SelectValue placeholder="Elige una comunidad" />
              </SelectTrigger>
              <SelectContent>
                {communities.map((community) => (
                  <SelectItem key={community.id} value={community.id}>
                    {community.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            structure &&
            parentLevels.map((position) => {
              const options = optionsFor(position);
              return (
                <div key={position} className="space-y-1">
                  <Label htmlFor={`unit-level-${position}`}>
                    {levelName(structure, position)}
                  </Label>
                  <Select
                    value={selections[position] ?? ''}
                    onValueChange={(value) => selectParent(position, value)}
                  >
                    <SelectTrigger id={`unit-level-${position}`} className="w-full">
                      <SelectValue placeholder={`Elige ${levelName(structure, position)}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {options.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Sin opciones en este nivel
                        </SelectItem>
                      ) : (
                        options.map((node) => (
                          <SelectItem key={node.id} value={node.id}>
                            {node.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              );
            })
          )}

          <div className="space-y-1">
            <Label htmlFor="unit-name">
              {structure ? levelName(structure, levelCount) : 'Unidad'}
            </Label>
            <Input
              id="unit-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setFieldError(null);
              }}
              placeholder="A-101"
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? 'unit-name-error' : undefined}
            />
            {fieldError && (
              <p id="unit-name-error" role="alert" className="text-xs text-destructive">
                {fieldError}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="unit-code">Código (opcional)</Label>
            <Input
              id="unit-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="A-101"
            />
          </div>

          {blockedMessage && (
            <Alert>
              <AlertDescription>{blockedMessage}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || loading || !structure || !parentsComplete}>
              {saving ? 'Creando…' : 'Crear unidad'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
