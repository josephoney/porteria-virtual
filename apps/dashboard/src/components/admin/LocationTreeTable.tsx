import { useMemo, type ReactNode } from 'react';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiDeleteBinLine,
  RiInboxArchiveLine,
  RiInboxUnarchiveLine,
  RiPencilLine,
  RiTeamLine,
  RiUserAddLine,
} from '@remixicon/react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { sectionTypeLabel } from '../../lib/section-types';
import { unitInviteIssue } from '../../lib/unit-invite';
import { useExpandedTree } from '../../lib/use-expanded-tree';

export interface LocationNode {
  id: string;
  communityId: string;
  structureId: string;
  parentId: string | null;
  levelPosition: number;
  name: string;
  code: string | null;
  sectionType: string | null;
  sectionTypeLabel: string | null;
  nodeType?: string | null;
  nodeTypeLabel?: string | null;
  metadata?: { legacyType?: string | null } | null;
  status: string;
}

export interface LocationStructureInfo {
  id: string;
  levelCount: number;
  level1Name: string;
  level2Name: string | null;
  level3Name: string | null;
}

export function structureLevelName(structure: LocationStructureInfo, level: number): string {
  if (level === 1) return structure.level1Name;
  if (level === 2) return structure.level2Name ?? 'Nivel 2';
  if (level === 3) return structure.level3Name ?? 'Nivel 3';
  return `Nivel ${level}`;
}

function pluralizeLabel(label: string, count: number): string {
  const lower = label.toLowerCase();
  return `${count} ${count === 1 || lower.endsWith('s') ? lower : `${lower}s`}`;
}

interface LocationTreeTableProps {
  structure: LocationStructureInfo;
  nodes: LocationNode[];
  mode: 'manage' | 'readonly';
  canInvite?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (node: LocationNode) => void;
  onAdd?: (parent: LocationNode | null, level: number) => void;
  onEdit?: (node: LocationNode) => void;
  onArchive?: (node: LocationNode) => void;
  onDelete?: (node: LocationNode) => void;
  onResidents?: (node: LocationNode) => void;
  onInvite?: (node: LocationNode) => void;
}

export function LocationTreeTable({
  structure,
  nodes,
  mode,
  canInvite = false,
  selectedIds,
  onToggleSelect,
  onAdd,
  onEdit,
  onArchive,
  onDelete,
  onResidents,
  onInvite,
}: LocationTreeTableProps) {
  const manage = mode === 'manage';
  const showSelection = manage && canInvite;
  const tree = useExpandedTree();

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, LocationNode[]>();
    [...nodes]
      .sort((left, right) => left.name.localeCompare(right.name, 'es'))
      .forEach((node) => {
        const bucket = map.get(node.parentId) ?? [];
        bucket.push(node);
        map.set(node.parentId, bucket);
      });
    return map;
  }, [nodes]);

  const roots = childrenByParent.get(null) ?? [];
  const columnCount = (manage ? 4 : 3) + (showSelection ? 1 : 0);

  function renderNode(node: LocationNode, depth: number): ReactNode[] {
    const children = childrenByParent.get(node.id) ?? [];
    const hasChildren = children.length > 0;
    const canExpand = hasChildren || (manage && node.levelPosition < structure.levelCount);
    const isExpanded = tree.isExpanded(node.id);
    const isLeaf = node.levelPosition >= structure.levelCount;
    const isArchived = node.status !== 'active';
    const inviteIssue = unitInviteIssue({
      status: node.status,
      levelPosition: node.levelPosition,
      levelCount: structure.levelCount,
      metadata: node.metadata,
    });
    const canSelect = showSelection && !inviteIssue;
    const selected = selectedIds?.has(node.id) ?? false;
    const childLevelName =
      node.levelPosition < structure.levelCount
        ? structureLevelName(structure, node.levelPosition + 1)
        : null;

    const rows: ReactNode[] = [
      <TableRow
        key={node.id}
        data-node-id={node.id}
        data-level={node.levelPosition}
        className={
          `${selected ? 'bg-muted/40 ' : ''}` +
          (canExpand ? 'cursor-pointer hover:bg-muted/50' : hasChildren ? '' : 'hover:bg-muted/50')
        }
        onClick={() => {
          if (canExpand) tree.toggle(node.id);
        }}
      >
        {showSelection && (
          <TableCell>
            <input
              type="checkbox"
              className="size-4 accent-foreground"
              checked={selected}
              disabled={!canSelect}
              title={inviteIssue ?? `Seleccionar ${node.name}`}
              aria-label={`Seleccionar ${node.name}`}
              onClick={(event) => event.stopPropagation()}
              onChange={() => onToggleSelect?.(node)}
            />
          </TableCell>
        )}
        <TableCell>
          <div className="flex items-center gap-2" style={{ paddingLeft: depth * 16 }}>
            {canExpand ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Contraer' : 'Expandir'} ${node.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  tree.toggle(node.id);
                }}
              >
                {isExpanded ? <RiArrowDownSLine /> : <RiArrowRightSLine />}
              </Button>
            ) : (
              <span aria-hidden className="inline-block size-6" />
            )}
            <span className={isArchived ? 'text-muted-foreground line-through' : undefined}>
              {node.name}
            </span>
            {hasChildren && (
              <span className="text-xs text-muted-foreground">
                {pluralizeLabel(childLevelName ?? 'nivel', children.length)}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="font-mono text-xs">{node.code ?? '—'}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Badge variant="outline">{node.status}</Badge>
            {(node.nodeType ?? node.sectionType) && (
              <Badge variant="secondary">
                {sectionTypeLabel(
                  node.nodeType ?? node.sectionType,
                  node.nodeTypeLabel ?? node.sectionTypeLabel,
                )}
              </Badge>
            )}
          </div>
        </TableCell>
        {manage && (
          <TableCell>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title={`Editar ${node.name}`}
                aria-label={`Editar ${node.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit?.(node);
                }}
              >
                <RiPencilLine />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title={isArchived ? `Restaurar ${node.name}` : `Archivar ${node.name}`}
                aria-label={isArchived ? `Restaurar ${node.name}` : `Archivar ${node.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onArchive?.(node);
                }}
              >
                {isArchived ? <RiInboxUnarchiveLine /> : <RiInboxArchiveLine />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title={
                  hasChildren
                    ? `No se puede eliminar ${node.name}: tiene elementos dentro`
                    : `Eliminar ${node.name}`
                }
                aria-label={`Eliminar ${node.name}`}
                disabled={hasChildren}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete?.(node);
                }}
              >
                <RiDeleteBinLine />
              </Button>
              {isLeaf && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    title={inviteIssue ?? `Invitar residente a ${node.name}`}
                    aria-label={`Invitar residente a ${node.name}`}
                    disabled={Boolean(inviteIssue)}
                    onClick={(event) => {
                      event.stopPropagation();
                      onInvite?.(node);
                    }}
                  >
                    <RiUserAddLine />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    title={`Residentes de ${node.name}`}
                    aria-label={`Residentes de ${node.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onResidents?.(node);
                    }}
                  >
                    <RiTeamLine />
                  </Button>
                </>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>,
    ];

    if (isExpanded) {
      children.forEach((child) => rows.push(...renderNode(child, depth + 1)));

      if (manage && childLevelName) {
        rows.push(
          <TableRow key={`add-${node.id}`} className="hover:bg-transparent">
            <TableCell colSpan={columnCount} className="py-1">
              <div style={{ paddingLeft: (depth + 1) * 16 }}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAdd?.(node, node.levelPosition + 1);
                  }}
                >
                  <RiAddLine /> Agregar {childLevelName.toLowerCase()}
                </Button>
              </div>
            </TableCell>
          </TableRow>,
        );
      }
    }

    return rows;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {showSelection && (
              <TableHead className="w-10">
                <span className="sr-only">Seleccionar</span>
              </TableHead>
            )}
            <TableHead>Nombre</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Estado</TableHead>
            {manage && <TableHead>Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {roots.length === 0 && (
            <TableRow>
              <TableCell colSpan={columnCount} className="py-8 text-center text-muted-foreground">
                Todavía no hay {structure.level1Name.toLowerCase()}s cargadas.
              </TableCell>
            </TableRow>
          )}

          {roots.flatMap((node) => renderNode(node, 0))}

          {manage && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="py-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => onAdd?.(null, 1)}
                >
                  <RiAddLine /> Agregar {structure.level1Name.toLowerCase()}
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
