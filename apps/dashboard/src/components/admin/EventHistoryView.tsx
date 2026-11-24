import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../lib/apiClient';
import { EVENT_TYPE_OPTIONS, eventTypeLabel } from '../../lib/event-types';
import { expandableRowProps, useExpandedRow } from '../../lib/use-expanded-row';
import { LoadingState } from '../ui/loading-state';
import { DetailField, DetailGrid } from '../ui/detail-field';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Pagination } from '../layout/Pagination';

interface OrganizationOption {
  id: string;
  name: string;
}

interface CommunityOption {
  id: string;
  name: string;
}

interface AccessPointOption {
  id: string;
  name: string;
  active: boolean;
}

interface EventTraceability {
  passId: string;
  passCode: string;
  visitorName: string | null;
  passCreatedAt: string | null;
  passCreatedBy: string | null;
  authorizedBy: string | null;
  scanId: string | null;
  scanAction: string | null;
  scanStatus: string | null;
  scannedAt: string | null;
  confirmedAt: string | null;
  reason: string | null;
  note: string | null;
  scanGuard: string | null;
}

interface EventRow {
  id: string;
  eventType: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  organizationId: string;
  organizationName: string | null;
  communityId: string | null;
  communityName: string | null;
  accessPointId: string | null;
  accessPointName: string | null;
  metadata: Record<string, unknown>;
  trace: EventTraceability | null;
  createdAt: string;
}

interface EventsResponse {
  data: EventRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface Filters {
  organizationId: string;
  communityId: string;
  accessPointId: string;
  eventType: string;
  actor: string;
  from: string;
  to: string;
}

const ALL = 'all';
const PAGE_SIZE = 20;

const ROLE_LABELS: Record<string, string> = {
  platform_admin: 'Superadmin',
  org_admin: 'Administrador de organización',
  community_admin: 'Administrador de comunidad',
  operator: 'Operador',
  guard: 'Guardia',
  owner: 'Propietario',
  tenant: 'Inquilino',
  resident: 'Residente',
  system: 'Sistema',
};

const SCAN_ACTION_LABELS: Record<string, string> = {
  entry: 'Ingreso',
  exit: 'Salida',
};

const SCAN_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  rejected: 'Rechazado',
  expired: 'Vencido',
};

const EMPTY_FILTERS: Filters = {
  organizationId: '',
  communityId: '',
  accessPointId: '',
  eventType: '',
  actor: '',
  from: '',
  to: '',
};

function eventBadgeVariant(
  eventType: string,
): 'default' | 'secondary' | 'warning' | 'outline' | 'destructive' {
  if (eventType === 'pass.entry' || eventType === 'access.granted') return 'default';
  if (eventType === 'pass.exit') return 'secondary';
  if (eventType === 'pass.rejected' || eventType === 'access.denied') return 'destructive';
  if (eventType.startsWith('call.') || eventType === 'kiosk.offline') return 'warning';
  return 'outline';
}

function formatDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function technicalJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2) ?? '{}';
  } catch {
    return 'No se pudieron mostrar los detalles técnicos.';
  }
}

function actorLabel(event: EventRow): string {
  if (event.actorName) return event.actorName;
  if (event.actorRole) return ROLE_LABELS[event.actorRole] ?? event.actorRole;
  return 'Sistema';
}

export function EventHistoryView() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [actorInput, setActorInput] = useState('');
  const [page, setPage] = useState(1);
  const { isExpanded, toggle } = useExpandedRow();

  // La búsqueda de actor es libre: se espera a que el usuario deje de escribir.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) =>
        current.actor === actorInput.trim() ? current : { ...current, actor: actorInput.trim() },
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [actorInput]);

  const organizationsQuery = useQuery({
    queryKey: ['platform', 'organizations', { pageSize: 100 }],
    queryFn: async () => {
      const { data } = await get<{ data: OrganizationOption[] }>(
        '/api/platform/organizations?pageSize=100',
      );
      return data.data;
    },
  });

  const communitiesQuery = useQuery({
    queryKey: [
      'platform',
      'communities',
      { pageSize: 100, organizationId: filters.organizationId || null },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: '100' });
      if (filters.organizationId) params.set('organizationId', filters.organizationId);
      const { data } = await get<{ data: CommunityOption[] }>(
        `/api/platform/communities?${params.toString()}`,
      );
      return data.data;
    },
  });

  const accessPointsQuery = useQuery({
    queryKey: ['communities', filters.communityId, 'access-points'],
    enabled: Boolean(filters.communityId),
    queryFn: async () => {
      const { data } = await get<{ items: AccessPointOption[] }>(
        `/api/communities/${filters.communityId}/access-points?includeInactive=true`,
      );
      return data.items;
    },
  });

  const eventsQuery = useQuery({
    queryKey: ['events', 'history', { ...filters, page, pageSize: PAGE_SIZE }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (filters.organizationId) params.set('organizationId', filters.organizationId);
      if (filters.communityId) params.set('communityId', filters.communityId);
      if (filters.accessPointId) params.set('accessPointId', filters.accessPointId);
      if (filters.eventType) params.set('eventType', filters.eventType);
      if (filters.actor) params.set('actor', filters.actor);
      if (filters.from) params.set('from', new Date(`${filters.from}T00:00:00`).toISOString());
      if (filters.to) params.set('to', new Date(`${filters.to}T23:59:59`).toISOString());
      const { data } = await get<EventsResponse>(`/api/events?${params.toString()}`);
      return data;
    },
  });

  const events = eventsQuery.data?.data ?? [];
  const total = eventsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Un filtro nuevo deja al usuario en una página que puede no existir.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function updateFilter(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function changeOrganization(value: string) {
    // Cambiar de organización invalida la comunidad y el acceso elegidos.
    updateFilter({
      organizationId: value === ALL ? '' : value,
      communityId: '',
      accessPointId: '',
    });
  }

  function changeCommunity(value: string) {
    updateFilter({
      communityId: value === ALL ? '' : value,
      accessPointId: '',
    });
  }

  function clearFilters() {
    setActorInput('');
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Organización</Label>
          <Select value={filters.organizationId || ALL} onValueChange={changeOrganization}>
            <SelectTrigger className="w-56" aria-label="Filtrar por organización">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las organizaciones</SelectItem>
              {(organizationsQuery.data ?? []).map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Comunidad</Label>
          <Select value={filters.communityId || ALL} onValueChange={changeCommunity}>
            <SelectTrigger className="w-56" aria-label="Filtrar por comunidad">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las comunidades</SelectItem>
              {(communitiesQuery.data ?? []).map((community) => (
                <SelectItem key={community.id} value={community.id}>
                  {community.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Acceso</Label>
          <Select
            value={filters.accessPointId || ALL}
            onValueChange={(value) => updateFilter({ accessPointId: value === ALL ? '' : value })}
          >
            <SelectTrigger
              className="w-48"
              aria-label="Filtrar por acceso"
              disabled={!filters.communityId}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los accesos</SelectItem>
              {(accessPointsQuery.data ?? []).map((accessPoint) => (
                <SelectItem key={accessPoint.id} value={accessPoint.id}>
                  {accessPoint.name}
                  {accessPoint.active ? '' : ' (inactivo)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Tipo de evento</Label>
          <Select
            value={filters.eventType || ALL}
            onValueChange={(value) => updateFilter({ eventType: value === ALL ? '' : value })}
          >
            <SelectTrigger className="w-56" aria-label="Filtrar por tipo de evento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los tipos</SelectItem>
              {EVENT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="history-actor">Actor</Label>
          <Input
            id="history-actor"
            value={actorInput}
            onChange={(event) => setActorInput(event.target.value)}
            placeholder="Nombre del actor"
            className="w-48"
            aria-label="Filtrar por actor"
          />
        </div>

        <div className="space-y-1">
          <Label>Desde</Label>
          <Input
            type="date"
            value={filters.from}
            onChange={(event) => updateFilter({ from: event.target.value })}
            aria-label="Filtrar desde"
          />
        </div>

        <div className="space-y-1">
          <Label>Hasta</Label>
          <Input
            type="date"
            value={filters.to}
            onChange={(event) => updateFilter({ to: event.target.value })}
            aria-label="Filtrar hasta"
          />
        </div>

        <Button type="button" variant="outline" onClick={clearFilters}>
          Limpiar
        </Button>
      </div>

      {eventsQuery.isPending ? (
        <LoadingState label="Cargando historial…" />
      ) : eventsQuery.isError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <p>No se pudo cargar el historial. Reintenta en unos segundos.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void eventsQuery.refetch()}
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
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Organización</TableHead>
                  <TableHead>Comunidad</TableHead>
                  <TableHead>Acceso</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead className="w-8">
                    <span className="sr-only">Detalle</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No hay eventos para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                )}
                {events.map((event) => {
                  const expanded = isExpanded(event.id);
                  return (
                    <EventTableRows
                      key={event.id}
                      event={event}
                      expanded={expanded}
                      onToggle={() => toggle(event.id)}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {total} {total === 1 ? 'evento' : 'eventos'}
            </span>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              disabled={eventsQuery.isFetching}
            />
          </div>
        </>
      )}
    </div>
  );
}

function EventTableRows({
  event,
  expanded,
  onToggle,
}: {
  event: EventRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow {...expandableRowProps(event.id, expanded, onToggle)}>
        <TableCell className="whitespace-nowrap">{formatDay(event.createdAt)}</TableCell>
        <TableCell className="whitespace-nowrap font-mono text-xs">
          {formatTime(event.createdAt)}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <Badge variant={eventBadgeVariant(event.eventType)}>
            {eventTypeLabel(event.eventType)}
          </Badge>
        </TableCell>
        <TableCell>{event.organizationName ?? '—'}</TableCell>
        <TableCell>{event.communityName ?? '—'}</TableCell>
        <TableCell>{event.accessPointName ?? '—'}</TableCell>
        <TableCell>
          <span>{actorLabel(event)}</span>
          {event.actorRole && (
            <span className="block text-xs text-muted-foreground">
              {ROLE_LABELS[event.actorRole] ?? event.actorRole}
            </span>
          )}
        </TableCell>
        <TableCell className="text-center text-muted-foreground">
          <span aria-hidden="true">{expanded ? '−' : '+'}</span>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30">
            <div className="space-y-5 py-2">
              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Evento técnico
                </h3>
                <DetailGrid>
                  <DetailField
                    label="ID del evento"
                    value={event.id}
                    valueClassName="font-mono text-xs"
                  />
                  <DetailField
                    label="Tipo"
                    value={
                      <span className="font-mono text-xs">
                        {eventTypeLabel(event.eventType)} · {event.eventType}
                      </span>
                    }
                  />
                  <DetailField label="Organización" value={event.organizationName ?? '—'} />
                  <DetailField label="Comunidad" value={event.communityName ?? '—'} />
                  <DetailField label="Acceso" value={event.accessPointName ?? '—'} />
                  <DetailField
                    label="Actor"
                    value={
                      <span>
                        {actorLabel(event)}
                        {event.actorRole
                          ? ` · ${ROLE_LABELS[event.actorRole] ?? event.actorRole}`
                          : ''}
                      </span>
                    }
                  />
                  <DetailField label="Generado" value={formatDateTime(event.createdAt)} />
                </DetailGrid>
              </section>

              {event.trace && (
                <section className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Trazabilidad del código
                  </h3>
                  <DetailGrid>
                    <DetailField
                      label="Código de pase"
                      value={event.trace.passCode}
                      valueClassName="font-mono text-xs"
                    />
                    <DetailField label="Visitante" value={event.trace.visitorName ?? '—'} />
                    <DetailField
                      label="Generado"
                      value={formatDateTime(event.trace.passCreatedAt)}
                    />
                    <DetailField label="Generado por" value={event.trace.passCreatedBy ?? '—'} />
                    <DetailField label="Autorizó" value={event.trace.authorizedBy ?? '—'} />
                    <DetailField label="Escaneado" value={formatDateTime(event.trace.scannedAt)} />
                    <DetailField
                      label="Confirmado"
                      value={formatDateTime(event.trace.confirmedAt)}
                    />
                    <DetailField
                      label="Acción"
                      value={
                        event.trace.scanAction
                          ? (SCAN_ACTION_LABELS[event.trace.scanAction] ?? event.trace.scanAction)
                          : '—'
                      }
                    />
                    <DetailField
                      label="Estado del escaneo"
                      value={
                        event.trace.scanStatus
                          ? (SCAN_STATUS_LABELS[event.trace.scanStatus] ?? event.trace.scanStatus)
                          : '—'
                      }
                    />
                    <DetailField label="Guardia del escaneo" value={event.trace.scanGuard ?? '—'} />
                    <DetailField label="Motivo" value={event.trace.reason ?? '—'} />
                    <DetailField label="Observación" value={event.trace.note ?? '—'} />
                    <DetailField
                      label="ID del escaneo"
                      value={event.trace.scanId ?? '—'}
                      valueClassName="font-mono text-xs"
                    />
                  </DetailGrid>
                </section>
              )}

              <details className="rounded-md border border-border bg-background/60">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Metadatos del evento
                </summary>
                <pre className="max-h-64 overflow-auto border-t border-border p-3 text-xs">
                  {technicalJson(event.metadata)}
                </pre>
              </details>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
