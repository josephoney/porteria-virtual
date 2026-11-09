import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiAddLine, RiUserLine } from '@remixicon/react';
import { del, get, patch, post } from '../../lib/apiClient';
import { StructureForm, type StructureInitial } from './StructureForm';
import { useAuth } from '../../contexts/AuthContext';
import { sectionTypeLabel } from '../../lib/section-types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';

interface StructureRow extends StructureInitial {
  communityName: string;
}

interface NodeRow {
  id: string;
  communityId: string;
  structureId: string;
  parentId: string | null;
  levelPosition: number;
  name: string;
  code: string | null;
  sectionType: string | null;
  sectionTypeLabel: string | null;
  status: string;
}

interface ResidentRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  relationship: string;
  status: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

type NodeDialogState =
  | { mode: 'create'; parent: NodeRow | null; structure: StructureRow }
  | { mode: 'move'; node: NodeRow }
  | { mode: 'rename'; node: NodeRow }
  | null;

function structureLevelName(structure: StructureRow | undefined, level: number): string {
  if (level === 1) return structure?.level1Name || 'Nivel 1';
  if (level === 2) return structure?.level2Name || 'Nivel 2';
  return structure?.level3Name || 'Nivel 3';
}

const RELATIONSHIPS = ['owner', 'tenant', 'resident', 'family', 'staff'] as const;
const RELATIONSHIP_LABELS: Record<string, string> = {
  owner: 'Propietario',
  tenant: 'Inquilino',
  resident: 'Residente',
  family: 'Familiar',
  staff: 'Staff',
};

export function StructureTreeDialog({
  communityId,
  communityName,
  open,
  onOpenChange,
}: {
  communityId: string;
  communityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, activeMembership } = useAuth();
  const [structures, setStructures] = useState<StructureRow[]>([]);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [editingStructure, setEditingStructure] = useState<StructureRow | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<NodeRow | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [residents, setResidents] = useState<ResidentRow[]>([]);
  const [residentUserId, setResidentUserId] = useState('');
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIPS)[number]>('resident');
  const [loading, setLoading] = useState(false);
  const [residentsLoading, setResidentsLoading] = useState(false);
  const [error, setError] = useState('');
  const [nodeDialog, setNodeDialog] = useState<NodeDialogState>(null);
  const [nodeName, setNodeName] = useState('');
  const [nodeCode, setNodeCode] = useState('');
  const [nodeParentId, setNodeParentId] = useState('');
  const [nodeSaving, setNodeSaving] = useState(false);
  const [nodeError, setNodeError] = useState('');

  const isPlatformContext = Boolean(
    user?.isPlatformAdmin && activeMembership?.id === 'platform',
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [structureResult, nodeResult] = await Promise.all([
        get<StructureRow[]>(`/api/location-structures?communityId=${communityId}`),
        get<NodeRow[]>(`/api/location-units?communityId=${communityId}`),
      ]);
      setStructures(structureResult.data);
      setNodes(nodeResult.data);

      if (user) {
        const usersResult = isPlatformContext
          ? await get<{ data: UserOption[] }>('/api/platform/users?pageSize=100')
          : await get<{ data: UserOption[] }>('/api/users?pageSize=100');
        setUsers(usersResult.data.data);
      }
    } catch {
      setError('No se pudo cargar la estructura.');
    } finally {
      setLoading(false);
    }
  }, [communityId, user, isPlatformContext]);

  useEffect(() => {
    if (open) {
      load();
      setSelectedUnit(null);
      setResidents([]);
      setResidentUserId('');
      setNodeDialog(null);
    }
  }, [open, load]);

  const sections = useMemo(
    () => nodes.filter((node) => node.levelPosition === 1),
    [nodes],
  );

  const structuresById = useMemo(() => {
    const map = new Map<string, StructureRow>();
    for (const structure of structures) map.set(structure.id, structure);
    return map;
  }, [structures]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, NodeRow[]>();
    for (const node of nodes) {
      if (!node.parentId) continue;
      const list = map.get(node.parentId) ?? [];
      list.push(node);
      map.set(node.parentId, list);
    }
    return map;
  }, [nodes]);

  const nodesById = useMemo(() => {
    const map = new Map<string, NodeRow>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const selectedPath = useMemo(() => {
    const path: NodeRow[] = [];
    let current = selectedUnit;
    while (current) {
      path.unshift(current);
      current = current.parentId ? nodesById.get(current.parentId) ?? null : null;
    }
    return path;
  }, [selectedUnit, nodesById]);

  function countLeafDescendants(nodeId: string, levelCount: number): number {
    const stack = [...(childrenByParent.get(nodeId) ?? [])];
    let total = 0;
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current.levelPosition === levelCount) {
        total += 1;
      } else {
        stack.push(...(childrenByParent.get(current.id) ?? []));
      }
    }
    return total;
  }

  const moveTargetLevel = nodeDialog?.mode === 'move' ? nodeDialog.node.levelPosition - 1 : 0;
  const moveTargets = useMemo(() => {
    if (nodeDialog?.mode !== 'move' || moveTargetLevel < 1) return [];
    return nodes.filter(
      (node) =>
        node.levelPosition === moveTargetLevel &&
        node.structureId === nodeDialog.node.structureId &&
        node.id !== nodeDialog.node.id,
    );
  }, [nodeDialog, nodes, moveTargetLevel]);

  async function selectUnit(unit: NodeRow) {
    setSelectedUnit(unit);
    setResidents([]);
    setResidentsLoading(true);
    try {
      const result = await get<ResidentRow[]>(`/api/units/${unit.id}/residents`);
      setResidents(result.data);
    } catch {
      setError('No se pudieron cargar los residentes.');
    } finally {
      setResidentsLoading(false);
    }
  }

  async function addResident(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedUnit || !residentUserId) return;
    setError('');
    try {
      await post(`/api/units/${selectedUnit.id}/residents`, {
        userId: residentUserId,
        relationship,
      });
      setResidentUserId('');
      await selectUnit(selectedUnit);
    } catch {
      setError('No se pudo asociar el residente.');
    }
  }

  function openCreateRoot(structure: StructureRow) {
    setNodeDialog({ mode: 'create', parent: null, structure });
    setNodeName(`Nuevo ${structureLevelName(structure, 1).toLowerCase()}`);
    setNodeCode('');
    setNodeError('');
  }

  function openCreateChild(parent: NodeRow, structure: StructureRow) {
    const childLevel = parent.levelPosition + 1;
    setNodeDialog({ mode: 'create', parent, structure });
    setNodeName(`Nuevo ${structureLevelName(structure, childLevel).toLowerCase()}`);
    setNodeCode('');
    setNodeError('');
  }

  function openMove(node: NodeRow) {
    setNodeDialog({ mode: 'move', node });
    setNodeParentId(node.parentId ?? '');
    setNodeError('');
  }

  function openRename(node: NodeRow) {
    setNodeDialog({ mode: 'rename', node });
    setNodeName(node.name);
    setNodeCode(node.code ?? '');
    setNodeError('');
  }

  async function submitNode(event: React.FormEvent) {
    event.preventDefault();
    if (!nodeDialog) return;
    setNodeSaving(true);
    setNodeError('');
    try {
      if (nodeDialog.mode === 'move') {
        await post(`/api/location-units/${nodeDialog.node.id}/move`, {
          parentId: nodeParentId || null,
        });
      } else if (nodeDialog.mode === 'rename') {
        await patch(`/api/location-units/${nodeDialog.node.id}`, {
          name: nodeName,
          code: nodeCode || null,
        });
      } else {
        const parentId = nodeDialog.parent?.id ?? null;
        await post('/api/location-units', {
          communityId,
          ...(parentId
            ? { parentId }
            : {
                structureId: nodeDialog.structure.id,
                sectionType: 'other',
                sectionTypeLabel: nodeDialog.structure.level1Name,
              }),
          name: nodeName,
          code: nodeCode || null,
        });
      }
      const touchedNodeId =
        nodeDialog.mode === 'move' || nodeDialog.mode === 'rename'
          ? nodeDialog.node.id
          : null;
      setNodeDialog(null);
      if (touchedNodeId && selectedUnit?.id === touchedNodeId) {
        setSelectedUnit(null);
      }
      await load();
    } catch (err) {
      setNodeError(
        err instanceof Error
          ? err.message
          : nodeDialog.mode === 'move'
            ? 'No se pudo mover el nodo.'
            : nodeDialog.mode === 'rename'
              ? 'No se pudo renombrar el nodo.'
              : 'No se pudo crear el nodo.',
      );
    } finally {
      setNodeSaving(false);
    }
  }

  async function deleteNode(node: NodeRow) {
    const label = node.code ?? node.name;
    if (!window.confirm(`¿Eliminar "${label}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setError('');
    try {
      await del(`/api/location-units/${node.id}`);
      if (selectedUnit?.id === node.id) setSelectedUnit(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo eliminar el nodo.',
      );
    }
  }

  async function setArchived(node: NodeRow, archive: boolean) {
    setError('');
    try {
      await post(`/api/location-units/${node.id}/${archive ? 'archive' : 'restore'}`);
      setSelectedUnit(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : archive
            ? 'No se pudo archivar el nodo.'
            : 'No se pudo restaurar el nodo.',
      );
    }
  }

  async function deleteSection(section: NodeRow) {
    if (
      !window.confirm(
        `¿Eliminar la sección "${section.name}"? Solo se permite si no tiene nodos.`,
      )
    ) {
      return;
    }
    setError('');
    try {
      await del(`/api/sections/${section.id}`);
      setSelectedUnit(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo eliminar la sección.',
      );
    }
  }

  const moveTargetStructure =
    nodeDialog?.mode === 'move'
      ? structuresById.get(nodeDialog.node.structureId)
      : undefined;
  const moveTargetName =
    nodeDialog?.mode === 'move'
      ? structureLevelName(moveTargetStructure, moveTargetLevel)
      : 'destino';

  const nodeTitle =
    nodeDialog?.mode === 'create'
      ? nodeDialog.parent
        ? `Nuevo ${structureLevelName(
            nodeDialog.structure,
            nodeDialog.parent.levelPosition + 1,
          )} en ${nodeDialog.parent.name}`
        : `Nuevo ${structureLevelName(nodeDialog.structure, 1)}`
      : nodeDialog?.mode === 'rename'
        ? `Renombrar ${nodeDialog.node.name}`
        : nodeDialog?.mode === 'move'
          ? `Mover ${nodeDialog.node.name}`
          : 'Nodo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-h-[85vh] sm:max-w-4xl sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle>Estructura · {communityName}</DialogTitle>
          <DialogDescription>
            Niveles, nodos y residentes de la comunidad.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {structures.length > 0 && (
          <div className="space-y-2">
            {structures.map((structure) => (
              <div
                key={structure.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{structure.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {structure.levelCount} niveles · {structure.level1Name}
                    {structure.level2Name ? ` → ${structure.level2Name}` : ''}
                    {structure.level3Name ? ` → ${structure.level3Name}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openCreateRoot(structure)}
                  >
                    <RiAddLine className="size-4" />
                    Nueva {structureLevelName(structure, 1)}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingStructure(structure)}
                  >
                    Editar estructura
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : sections.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay nodos raíz en esta comunidad. Creá uno desde la estructura.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-3">
              {sections.map((section) => {
                const structure = structuresById.get(section.structureId);
                const levelCount = structure?.levelCount ?? 3;
                const childLevelName = structureLevelName(structure, 2);
                const sectionChildren = childrenByParent.get(section.id) ?? [];
                const unitCount =
                  levelCount === 1
                    ? 1
                    : countLeafDescendants(section.id, levelCount);

                return (
                  <div key={section.id} className="rounded-xl border border-border">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{section.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {sectionTypeLabel(section.sectionType, section.sectionTypeLabel)} ·{' '}
                          {levelCount} niveles · {unitCount} unidades
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {section.status === 'active' ? 'Activa' : 'Archivada'}
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setArchived(section, section.status === 'active')}
                        >
                          {section.status === 'active' ? 'Archivar' : 'Restaurar'}
                        </Button>
                        {structure && levelCount >= 2 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openCreateChild(section, structure)}
                          >
                            <RiAddLine className="size-4" />
                            {childLevelName}
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteSection(section)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2 p-3">
                      {levelCount === 1 && (
                        <Button
                          type="button"
                          variant={selectedUnit?.id === section.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => selectUnit(section)}
                        >
                          {section.code ?? section.name}
                        </Button>
                      )}

                      {levelCount === 2 &&
                        (sectionChildren.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Sin {childLevelName.toLowerCase()}s.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {sectionChildren.map((child) => (
                              <Button
                                key={child.id}
                                type="button"
                                variant={
                                  selectedUnit?.id === child.id ? 'default' : 'outline'
                                }
                                size="sm"
                                className={
                                  child.status === 'inactive'
                                    ? 'max-w-full truncate opacity-50'
                                    : 'max-w-full truncate'
                                }
                                onClick={() => selectUnit(child)}
                              >
                                {child.code ?? child.name}
                              </Button>
                            ))}
                          </div>
                        ))}

                      {levelCount >= 3 &&
                        (sectionChildren.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Sin {childLevelName.toLowerCase()}s.
                          </p>
                        ) : (
                          sectionChildren.map((child) => {
                            const leafNodes = childrenByParent.get(child.id) ?? [];
                            return (
                              <div
                                key={child.id}
                                className="rounded-lg border border-border/70 p-2"
                              >
                                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                      {child.name}
                                    </p>
                                    <Badge variant="outline">
                                      {child.status === 'active' ? 'Activo' : 'Archivado'}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setArchived(child, child.status === 'active')
                                      }
                                    >
                                      {child.status === 'active' ? 'Archivar' : 'Restaurar'}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openRename(child)}
                                    >
                                      Renombrar
                                    </Button>
                                    {structure && levelCount >= 3 && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => openCreateChild(child, structure)}
                                      >
                                        <RiAddLine className="size-4" />
                                        {structureLevelName(structure, 3)}
                                      </Button>
                                    )}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive"
                                      onClick={() => deleteNode(child)}
                                    >
                                      Eliminar
                                    </Button>
                                  </div>
                                </div>
                                {leafNodes.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    Sin {structureLevelName(structure, 3).toLowerCase()}s.
                                  </p>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {leafNodes.map((leaf) => (
                                      <Button
                                        key={leaf.id}
                                        type="button"
                                        variant={
                                          selectedUnit?.id === leaf.id
                                            ? 'default'
                                            : 'outline'
                                        }
                                        size="sm"
                                        className={
                                          leaf.status === 'inactive'
                                            ? 'max-w-full truncate opacity-50'
                                            : 'max-w-full truncate'
                                        }
                                        onClick={() => selectUnit(leaf)}
                                      >
                                        {leaf.code ?? leaf.name}
                                      </Button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-border p-3">
              {!selectedUnit ? (
                <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <RiUserLine className="size-6 opacity-40" />
                  Seleccioná una unidad para ver o asociar residentes.
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {selectedUnit.code ?? selectedUnit.name}
                      </p>
                      <Badge variant="outline">
                        {selectedUnit.status === 'active' ? 'Activa' : 'Archivada'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedPath.length > 1
                        ? selectedPath
                            .slice(0, -1)
                            .map((node) => node.name)
                            .join(' · ')
                        : 'Nodo raíz'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setArchived(selectedUnit, selectedUnit.status === 'active')
                      }
                    >
                      {selectedUnit.status === 'active' ? 'Archivar' : 'Restaurar'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openRename(selectedUnit)}
                    >
                      Renombrar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openMove(selectedUnit)}
                    >
                      Mover unidad
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => deleteNode(selectedUnit)}
                    >
                      Eliminar unidad
                    </Button>
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    {residentsLoading && <Skeleton className="h-10 w-full" />}
                    {!residentsLoading && residents.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No hay residentes asociados.
                      </p>
                    )}
                    {residents.map((resident) => (
                      <div key={resident.id} className="rounded-lg bg-muted/40 p-2 text-sm">
                        <p className="font-medium">{resident.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {resident.userEmail} ·{' '}
                          {RELATIONSHIP_LABELS[resident.relationship] ?? resident.relationship}
                        </p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={addResident} className="space-y-2 border-t border-border pt-3">
                    <select
                      className="h-9 w-full rounded border border-border bg-card px-2 text-sm"
                      value={residentUserId}
                      onChange={(event) => setResidentUserId(event.target.value)}
                      required
                    >
                      <option value="">Asociar usuario…</option>
                      {users.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name} · {option.email}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-9 w-full rounded border border-border bg-card px-2 text-sm"
                      value={relationship}
                      onChange={(event) =>
                        setRelationship(event.target.value as (typeof RELATIONSHIPS)[number])
                      }
                    >
                      {RELATIONSHIPS.map((value) => (
                        <option key={value} value={value}>
                          {RELATIONSHIP_LABELS[value]}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" className="w-full">
                      <RiAddLine className="size-4" />
                      Asociar residente
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      <Dialog
        open={Boolean(editingStructure)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingStructure(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar estructura</DialogTitle>
            <DialogDescription>
              Cambiá el nombre o los niveles de la estructura.
            </DialogDescription>
          </DialogHeader>
          {editingStructure && (
            <StructureForm
              communities={[{ id: communityId, name: communityName }]}
              initial={editingStructure}
              onSaved={() => {
                setEditingStructure(null);
                load();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(nodeDialog)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setNodeDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{nodeTitle}</DialogTitle>
            <DialogDescription>
              {nodeDialog?.mode === 'move'
                ? `Elegí el ${moveTargetName.toLowerCase()} de destino.`
                : nodeDialog?.mode === 'rename'
                  ? 'Cambiá el nombre o el código del nodo.'
                  : 'Completá el nombre y, opcionalmente, un código.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitNode} className="space-y-4">
            {nodeDialog?.mode === 'move' ? (
              <div className="space-y-1">
                <Label htmlFor="node-parent">{moveTargetName} destino</Label>
                <select
                  id="node-parent"
                  className="h-9 w-full rounded border border-border bg-card px-2 text-sm"
                  value={nodeParentId}
                  onChange={(event) => setNodeParentId(event.target.value)}
                  required
                >
                  <option value="">Elegir {moveTargetName.toLowerCase()}…</option>
                  {moveTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="node-name">Nombre</Label>
                  <Input
                    id="node-name"
                    value={nodeName}
                    onChange={(event) => setNodeName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="node-code">Código</Label>
                  <Input
                    id="node-code"
                    value={nodeCode}
                    onChange={(event) => setNodeCode(event.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </>
            )}
            {nodeError && (
              <p role="alert" className="text-sm text-destructive">
                {nodeError}
              </p>
            )}
            <Button
              type="submit"
              disabled={nodeSaving || (nodeDialog?.mode === 'move' && !nodeParentId)}
            >
              {nodeSaving
                ? 'Guardando…'
                : nodeDialog?.mode === 'move'
                  ? 'Mover'
                  : nodeDialog?.mode === 'rename'
                    ? 'Guardar'
                    : 'Crear'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
