import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get } from '../lib/apiClient';
import { PageHeader } from '../components/layout/PageHeader';
import { ListToolbar } from '../components/layout/ListToolbar';
import { Pagination } from '../components/layout/Pagination';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ResidentInviteDialog } from '../components/admin/ResidentInviteDialog';
import { UnitInviteSelectionBar } from '../components/admin/UnitInviteSelectionBar';
import { BulkInvitationsDialog } from '../components/admin/BulkInvitationsDialog';
import { CreateUnitDialog } from '../components/admin/CreateUnitDialog';
import { useAuth } from '../contexts/AuthContext';
import { unitInviteIssue } from '../lib/unit-invite';
import { RiFileUploadLine, RiUserAddLine } from '@remixicon/react';
import { LoadingState } from '../components/ui/loading-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { queryKeys } from '../lib/query-keys';

interface CommunityOption {
  id: string;
  name: string;
}

interface SectionOption {
  id: string;
  name: string;
  communityId: string;
}

interface UnitApiRow {
  id: string;
  communityId: string;
  communityName: string;
  sectionId: string | null;
  sectionName: string | null;
  path: string;
  name: string;
  code: string | null;
  metadata: { legacyFloor?: number | null; legacyType?: string | null } | null;
  status: string;
  levelPosition: number;
  levelCount: number;
}

interface UnitListResponse {
  data: UnitApiRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 10;

const EMPTY_COMMUNITIES: CommunityOption[] = [];
const EMPTY_SECTIONS: SectionOption[] = [];
const EMPTY_UNITS: UnitApiRow[] = [];

/**
 * Los tipos de unidad viven en `metadata.legacyType` (la columna `type` no
 * existe en `location_units`), por eso se traducen acá.
 */
const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartamento',
  house: 'Casa',
  commercial: 'Local comercial',
  office: 'Oficina',
  parking: 'Parqueadero',
  storage: 'Depósito',
  other: 'Otro',
};

function unitTypeLabel(type?: string | null): string {
  if (!type) return '—';
  return UNIT_TYPE_LABELS[type] ?? type;
}

function unitFloorLabel(floor?: number | null): string {
  return floor === null || floor === undefined ? '—' : String(floor);
}

function statusLabel(status: string): string {
  if (status === 'active') return 'Activa';
  if (status === 'inactive') return 'Inactiva';
  return status;
}

/**
 * Listado plano de unidades para `/platform/units` y `/admin/units`.
 *
 * Es de sólo lectura: todavía no existe `PATCH /api/units/:id`. El alcance lo
 * define la ruta, igual que en la página Estructura.
 */
export function UnitsPage() {
  const { pathname } = useLocation();
  const { user, activeMembership } = useAuth();
  const isPlatformScope = pathname.startsWith('/platform');
  const canInvite =
    Boolean(user?.isPlatformAdmin) ||
    ['org_admin', 'community_admin'].includes(activeMembership?.role ?? '');
  // El platform admin es read-only sobre tenant: la creación solo se ofrece en el
  // contexto de una comunidad.
  const canManageStructure =
    !isPlatformScope && ['org_admin', 'community_admin'].includes(activeMembership?.role ?? '');

  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [communityFilter, setCommunityFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUnits, setSelectedUnits] = useState<UnitApiRow[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const communitiesQuery = useQuery({
    queryKey: isPlatformScope ? queryKeys.platformCommunities : queryKeys.tenantCommunities,
    queryFn: async () => {
      if (isPlatformScope) {
        const { data } = await get<{ data: CommunityOption[] }>(
          '/api/platform/communities?pageSize=100',
        );
        return data.data;
      }
      const { data } = await get<CommunityOption[]>('/api/communities');
      return data;
    },
  });

  const communities = communitiesQuery.data ?? EMPTY_COMMUNITIES;

  const sectionsQuery = useQuery<SectionOption[]>({
    queryKey: queryKeys.sectionsOptions(communityFilter),
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: '100' });
      if (communityFilter !== 'all') params.set('communityId', communityFilter);
      const { data } = await get<{ data: SectionOption[] }>(`/api/sections?${params.toString()}`);
      return data.data;
    },
  });

  const sections = sectionsQuery.data ?? EMPTY_SECTIONS;

  const unitsQuery = useQuery<UnitListResponse>({
    queryKey: queryKeys.unitsList({
      page,
      communityId: communityFilter,
      sectionId: sectionFilter,
      status: statusFilter,
      search: debouncedSearch,
    }),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (communityFilter !== 'all') params.set('communityId', communityFilter);
      if (sectionFilter !== 'all') params.set('sectionId', sectionFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      const { data } = await get<UnitListResponse>(`/api/units?${params.toString()}`);
      return data;
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  // La sección depende de la comunidad: al cambiarla, la selección anterior
  // deja de ser válida.
  useEffect(() => {
    setSectionFilter('all');
    setPage(1);
  }, [communityFilter]);

  useEffect(() => {
    setPage(1);
  }, [sectionFilter, statusFilter, debouncedSearch]);

  const units = unitsQuery.data?.data ?? EMPTY_UNITS;
  const total = unitsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectionCommunityId = selectedUnits[0]?.communityId ?? null;

  function isSelected(unitId: string): boolean {
    return selectedUnits.some((unit) => unit.id === unitId);
  }

  function toggleUnit(unit: UnitApiRow) {
    if (isSelected(unit.id)) {
      setSelectedUnits((current) => current.filter((item) => item.id !== unit.id));
      setInviteError('');
      return;
    }
    if (selectionCommunityId && selectionCommunityId !== unit.communityId) {
      setInviteError(
        'Una invitación sólo puede incluir unidades de la misma comunidad. Limpia la selección para cambiar de comunidad.',
      );
      return;
    }
    setSelectedUnits((current) => [...current, unit]);
    setInviteError('');
  }

  function openInvite(unit?: UnitApiRow) {
    if (unit) setSelectedUnits([unit]);
    setInviteError('');
    setInviteOpen(true);
  }

  function clearSelection() {
    setSelectedUnits([]);
    setInviteError('');
  }

  return (
    <div className={selectedUnits.length > 0 ? 'p-6 pb-28 space-y-6' : 'p-6 space-y-6'}>
      <PageHeader
        title="Unidades"
        description="Unidades de cada comunidad, con su sección, tipo y piso."
        actions={
          <div className="flex items-center gap-3">
            {canManageStructure && (
              <Button type="button" onClick={() => setCreateOpen(true)}>
                Nueva unidad
              </Button>
            )}
            {unitsQuery.isFetching && !unitsQuery.isPending ? (
              <span role="status" className="text-xs text-muted-foreground">
                Actualizando…
              </span>
            ) : null}
          </div>
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Buscar por código o nombre…"
      >
        <Select value={communityFilter} onValueChange={setCommunityFilter}>
          <SelectTrigger className="w-56" aria-label="Filtrar por comunidad">
            <SelectValue placeholder="Todas las comunidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las comunidades</SelectItem>
            {communities.map((community) => (
              <SelectItem key={community.id} value={community.id}>
                {community.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sectionFilter} onValueChange={setSectionFilter}>
          <SelectTrigger className="w-56" aria-label="Filtrar por sección">
            <SelectValue placeholder="Todas las secciones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las secciones</SelectItem>
            {sections.map((section) => (
              <SelectItem key={section.id} value={section.id}>
                {section.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="Filtrar por estado">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activa</SelectItem>
            <SelectItem value="inactive">Inactiva</SelectItem>
          </SelectContent>
        </Select>

        {canInvite && (
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <RiFileUploadLine className="size-4" aria-hidden="true" />
            Carga masiva
          </Button>
        )}
      </ListToolbar>

      {inviteError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {inviteError}
        </div>
      )}

      {unitsQuery.isPending ? (
        <LoadingState label="Cargando unidades…" />
      ) : unitsQuery.isError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <p>No se pudieron cargar las unidades. Reintenta en unos segundos.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void unitsQuery.refetch()}
          >
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {canInvite && (
                    <TableHead className="w-10">
                      <span className="sr-only">Seleccionar</span>
                    </TableHead>
                  )}
                  <TableHead>Código</TableHead>
                  <TableHead>Unidad / sección</TableHead>
                  <TableHead>Comunidad</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Piso</TableHead>
                  <TableHead>Estado</TableHead>
                  {canInvite && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canInvite ? 8 : 6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No hay unidades para mostrar
                    </TableCell>
                  </TableRow>
                )}
                {units.map((unit) => {
                  const issue = unitInviteIssue(unit);
                  const otherCommunity =
                    Boolean(selectionCommunityId) &&
                    selectionCommunityId !== unit.communityId &&
                    !isSelected(unit.id);
                  const checkboxDisabled = Boolean(issue) || otherCommunity;
                  return (
                    <TableRow key={unit.id}>
                      {canInvite && (
                        <TableCell>
                          <input
                            type="checkbox"
                            className="size-4 accent-foreground"
                            checked={isSelected(unit.id)}
                            disabled={checkboxDisabled}
                            title={
                              issue ??
                              (otherCommunity
                                ? 'Sólo se pueden invitar unidades de la misma comunidad.'
                                : `Seleccionar ${unit.name}`)
                            }
                            aria-label={`Seleccionar ${unit.name}`}
                            onChange={() => toggleUnit(unit)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs">{unit.code ?? '—'}</TableCell>
                      <TableCell>
                        <div className="font-medium">{unit.name}</div>
                        {unit.sectionName && (
                          <div className="text-xs text-muted-foreground">{unit.sectionName}</div>
                        )}
                      </TableCell>
                      <TableCell>{unit.communityName}</TableCell>
                      <TableCell>{unitTypeLabel(unit.metadata?.legacyType)}</TableCell>
                      <TableCell>{unitFloorLabel(unit.metadata?.legacyFloor)}</TableCell>
                      <TableCell>
                        <Badge variant={unit.status === 'active' ? 'secondary' : 'outline'}>
                          {statusLabel(unit.status)}
                        </Badge>
                      </TableCell>
                      {canInvite && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Invitar residente a ${unit.name}`}
                            title={issue ?? `Invitar residente a ${unit.name}`}
                            disabled={Boolean(issue)}
                            onClick={() => openInvite(unit)}
                          >
                            <RiUserAddLine className="size-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ResidentInviteDialog
            open={inviteOpen}
            onOpenChange={(open) => {
              setInviteOpen(open);
              if (!open) setInviteError('');
            }}
            units={selectedUnits}
            onCreated={() => {
              setSelectedUnits([]);
              void unitsQuery.refetch();
            }}
          />

          <UnitInviteSelectionBar
            count={selectedUnits.length}
            onInvite={() => openInvite()}
            onClear={clearSelection}
          />

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            disabled={unitsQuery.isFetching}
          />
        </>
      )}

      <CreateUnitDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        communities={communities}
        defaultCommunityId={communityFilter !== 'all' ? communityFilter : undefined}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ['units'] });
          void queryClient.invalidateQueries({ queryKey: ['sections'] });
        }}
      />

      <BulkInvitationsDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        communities={communities}
        defaultCommunityId={communityFilter !== 'all' ? communityFilter : undefined}
        onCreated={() => {
          clearSelection();
          void unitsQuery.refetch();
        }}
      />
    </div>
  );
}
