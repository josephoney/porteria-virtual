import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { get, del, patch, post } from '../../lib/apiClient';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { FormDialog } from '../layout/FormDialog';
import { StructureForm } from '../layout/StructureForm';
import {
  LocationTreeTable,
  structureLevelName,
  type LocationNode,
  type LocationStructureInfo,
} from './LocationTreeTable';
import { ResidentAssignmentPanel } from './ResidentAssignmentPanel';

interface StructureRow extends LocationStructureInfo {
  communityId: string;
  name: string;
}

interface CommunityOption {
  id: string;
  name: string;
}

interface UnitsWorkspaceProps {
  communities: CommunityOption[];
  onStructureChanged?: () => void;
}

type NodeDialogState =
  | { mode: 'create'; parent: LocationNode | null; level: number }
  | { mode: 'edit'; node: LocationNode }
  | null;

type ConfirmState = { kind: 'archive' | 'restore' | 'delete'; node: LocationNode } | null;

const STORAGE_KEY = 'porteria.units.community';

function countDescendants(nodeId: string, nodes: LocationNode[]): number {
  const childrenByParent = new Map<string, LocationNode[]>();
  nodes.forEach((node) => {
    if (!node.parentId) return;
    const bucket = childrenByParent.get(node.parentId) ?? [];
    bucket.push(node);
    childrenByParent.set(node.parentId, bucket);
  });

  let total = 0;
  const stack = [...(childrenByParent.get(nodeId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    total += 1;
    stack.push(...(childrenByParent.get(current.id) ?? []));
  }
  return total;
}

export function UnitsWorkspace({ communities, onStructureChanged }: UnitsWorkspaceProps) {
  const [communityId, setCommunityId] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && communities.some((community) => community.id === stored)
      ? stored
      : (communities[0]?.id ?? '');
  });
  const [structure, setStructure] = useState<StructureRow | null>(null);
  const [nodes, setNodes] = useState<LocationNode[]>([]);
  const [loading, setLoading] = useState(Boolean(communities.length));
  const [error, setError] = useState('');

  const [nodeDialog, setNodeDialog] = useState<NodeDialogState>(null);
  const [nodeName, setNodeName] = useState('');
  const [nodeCode, setNodeCode] = useState('');
  const [nodeSaving, setNodeSaving] = useState(false);
  const [nodeError, setNodeError] = useState('');

  const [confirmTarget, setConfirmTarget] = useState<ConfirmState>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);

  const [residentsTarget, setResidentsTarget] = useState<LocationNode | null>(null);
  const [structureFormOpen, setStructureFormOpen] = useState(false);

  const selectedCommunity = useMemo(
    () => communities.find((community) => community.id === communityId) ?? null,
    [communities, communityId],
  );

  const load = useCallback(async () => {
    if (!communityId) {
      setStructure(null);
      setNodes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [structureResult, nodesResult] = await Promise.all([
        get<StructureRow[]>(
          `/api/location-structures?communityId=${encodeURIComponent(communityId)}`,
        ),
        get<LocationNode[]>(`/api/location-units?communityId=${encodeURIComponent(communityId)}`),
      ]);
      setStructure(structureResult.data[0] ?? null);
      setNodes(nodesResult.data);
    } catch {
      setError('No se pudo cargar la estructura de la comunidad.');
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!communityId) return;
    localStorage.setItem(STORAGE_KEY, communityId);
  }, [communityId]);

  const refreshAll = useCallback(async () => {
    await load();
    onStructureChanged?.();
  }, [load, onStructureChanged]);

  function openCreate(parent: LocationNode | null, level: number) {
    setNodeDialog({ mode: 'create', parent, level });
    setNodeName('');
    setNodeCode('');
    setNodeError('');
  }

  function openEdit(node: LocationNode) {
    setNodeDialog({ mode: 'edit', node });
    setNodeName(node.name);
    setNodeCode(node.code ?? '');
    setNodeError('');
  }

  async function saveNode(event: FormEvent) {
    event.preventDefault();
    if (!nodeDialog) return;
    setNodeSaving(true);
    setNodeError('');
    try {
      if (nodeDialog.mode === 'edit') {
        await patch(`/api/location-units/${nodeDialog.node.id}`, {
          name: nodeName,
          code: nodeCode || null,
        });
      } else if (nodeDialog.parent) {
        await post('/api/location-units', {
          communityId,
          parentId: nodeDialog.parent.id,
          name: nodeName,
          code: nodeCode || null,
        });
      } else if (structure) {
        await post('/api/location-units', {
          communityId,
          structureId: structure.id,
          name: nodeName,
          code: nodeCode || null,
          sectionType: 'other',
          sectionTypeLabel: structure.level1Name,
        });
      }
      setNodeDialog(null);
      await refreshAll();
    } catch (err) {
      setNodeError(err instanceof Error ? err.message : 'No se pudo guardar el elemento.');
    } finally {
      setNodeSaving(false);
    }
  }

  async function confirmMutation() {
    if (!confirmTarget) return;
    setConfirmSaving(true);
    setError('');
    try {
      if (confirmTarget.kind === 'delete') {
        await del(`/api/location-units/${confirmTarget.node.id}`);
      } else {
        await post(
          `/api/location-units/${confirmTarget.node.id}/${confirmTarget.kind === 'archive' ? 'archive' : 'restore'}`,
        );
      }
      setConfirmTarget(null);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la acción.');
    } finally {
      setConfirmSaving(false);
    }
  }

  if (communities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Todavía no hay comunidades. Creá una en Comunidades para definir su estructura.
      </div>
    );
  }

  const confirmChildren = confirmTarget ? countDescendants(confirmTarget.node.id, nodes) : 0;
  const dialogLevelName = !structure
    ? 'Elemento'
    : structureLevelName(
        structure,
        nodeDialog?.mode === 'edit' ? nodeDialog.node.levelPosition : (nodeDialog?.level ?? 1),
      );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={communityId} onValueChange={setCommunityId}>
          <SelectTrigger className="w-64" aria-label="Comunidad">
            <SelectValue placeholder="Elegí una comunidad" />
          </SelectTrigger>
          <SelectContent>
            {communities.map((community) => (
              <SelectItem key={community.id} value={community.id}>
                {community.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCommunity && (
          <p className="text-sm text-muted-foreground">Estructura de {selectedCommunity.name}</p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : !structure ? (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-6">
          <div>
            <h3 className="text-sm font-semibold">Sin estructura definida</h3>
            <p className="text-sm text-muted-foreground">
              Definí los niveles de la comunidad para empezar a cargar sus elementos.
            </p>
          </div>
          <Button onClick={() => setStructureFormOpen(true)}>Definir estructura</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Estructura · {structure.name}</p>
              <p className="text-sm text-muted-foreground">
                {structure.levelCount} niveles ·{' '}
                {[structure.level1Name, structure.level2Name, structure.level3Name]
                  .filter(Boolean)
                  .join(' → ')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setStructureFormOpen(true)}>
              Editar estructura
            </Button>
          </div>

          <LocationTreeTable
            key={communityId}
            structure={structure}
            nodes={nodes}
            mode="manage"
            onAdd={openCreate}
            onEdit={openEdit}
            onArchive={(node) =>
              setConfirmTarget({ kind: node.status === 'archived' ? 'restore' : 'archive', node })
            }
            onDelete={(node) => setConfirmTarget({ kind: 'delete', node })}
            onResidents={setResidentsTarget}
          />
        </>
      )}

      <FormDialog
        open={structureFormOpen}
        onOpenChange={setStructureFormOpen}
        title={structure ? 'Editar estructura' : 'Definir estructura'}
        description="Definí los niveles y los nombres de la jerarquía de la comunidad."
        hideTrigger
      >
        <StructureForm
          communities={selectedCommunity ? [selectedCommunity] : communities}
          initial={structure ?? undefined}
          onSaved={() => {
            setStructureFormOpen(false);
            void refreshAll();
          }}
        />
      </FormDialog>

      <Dialog
        open={Boolean(nodeDialog)}
        onOpenChange={(open) => {
          if (!open) setNodeDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {nodeDialog?.mode === 'edit'
                ? `Editar ${dialogLevelName.toLowerCase()}`
                : `Agregar ${dialogLevelName.toLowerCase()}`}
            </DialogTitle>
            <DialogDescription>
              {nodeDialog?.mode === 'create' && nodeDialog.parent
                ? `Se va a crear dentro de ${nodeDialog.parent.name}.`
                : 'El nombre es obligatorio; el código es opcional.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveNode} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="unit-node-name">Nombre</Label>
              <Input
                id="unit-node-name"
                value={nodeName}
                onChange={(event) => setNodeName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit-node-code">Código</Label>
              <Input
                id="unit-node-code"
                value={nodeCode}
                onChange={(event) => setNodeCode(event.target.value)}
                placeholder="Opcional"
              />
            </div>
            {nodeError && (
              <p role="alert" className="text-sm text-destructive">
                {nodeError}
              </p>
            )}
            <Button type="submit" disabled={nodeSaving}>
              {nodeSaving ? 'Guardando…' : 'Guardar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmTarget?.kind === 'delete'
                ? `Eliminar ${confirmTarget.node.name}`
                : confirmTarget?.kind === 'restore'
                  ? `Restaurar ${confirmTarget?.node.name}`
                  : `Archivar ${confirmTarget?.node.name}`}
            </DialogTitle>
            <DialogDescription>
              {confirmTarget?.kind === 'delete'
                ? 'Esta acción no se puede deshacer.'
                : confirmChildren > 0
                  ? `La acción alcanza ${confirmChildren} elemento${confirmChildren === 1 ? '' : 's'} dentro de este nodo.`
                  : 'La acción alcanza solo a este elemento.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant={confirmTarget?.kind === 'delete' ? 'destructive' : 'default'}
              disabled={confirmSaving}
              onClick={() => void confirmMutation()}
            >
              {confirmSaving
                ? 'Procesando…'
                : confirmTarget?.kind === 'delete'
                  ? 'Eliminar'
                  : confirmTarget?.kind === 'restore'
                    ? 'Restaurar'
                    : 'Archivar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(residentsTarget)}
        onOpenChange={(open) => {
          if (!open) setResidentsTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {residentsTarget && (
            <ResidentAssignmentPanel unitId={residentsTarget.id} unitName={residentsTarget.name} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
