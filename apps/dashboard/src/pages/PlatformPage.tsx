import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { get, post, patch } from '../lib/apiClient';
import { Tabs, TabsContent } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCards } from '../components/layout/SectionCards';
import { FormDialog } from '../components/layout/FormDialog';
import { ListToolbar } from '../components/layout/ListToolbar';
import { StructureTreeDialog } from '../components/layout/StructureTreeDialog';
import { StructureForm } from '../components/layout/StructureForm';
import { SECTION_TYPE_LABELS, sectionTypeLabel } from '../lib/section-types';
import { Skeleton } from '../components/ui/skeleton';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationOverview {
  organization: {
    id: string;
    name: string;
    slug: string;
    nit: string | null;
    phone: string | null;
    address: string | null;
    welcomeMessage: string | null;
  };
  legalRepresentative: {
    firstName: string;
    lastName: string;
    documentType: string | null;
    documentNumber: string | null;
    phone: string | null;
    contactEmail: string | null;
  } | null;
  administrator: {
    name: string;
    email: string;
    role: string;
    status: string;
  } | null;
  pendingAdministrator: {
    id: string;
    email: string;
    status: string;
  } | null;
  communities: Array<{
    id: string;
    name: string;
    slug: string;
    address: string;
    phone: string | null;
    type: string;
    status: string;
    sectionCount: number;
    unitCount: number;
  }>;
}

interface Community {
  id: string;
  name: string;
  slug: string;
  address: string;
  timezone: string;
  status: string;
  organizationId: string;
  organizationName: string;
}

interface Building {
  id: string;
  communityId: string;
  communityName: string;
  name: string;
  code: string | null;
  levelCount: number;
  unitCount: number;
  sectionType: string | null;
  sectionTypeLabel: string | null;
  status: string;
}

interface Unit {
  id: string;
  communityId: string;
  sectionId: string | null;
  sectionName: string;
  path: string;
  communityName: string;
  code: string;
  floor: number | null;
  type: string;
  status: string;
}

interface UnitApi extends Omit<Unit, 'floor' | 'type'> {
  metadata: { legacyFloor?: number; legacyType?: string } | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  communityId: string | null;
  unitId: string | null;
  locationUnitId: string | null;
  expiresAt: string;
}

interface PlatformUser {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  active: boolean;
  memberships: Array<{
    id: string;
    role: string;
    status: string;
    organizationId: string;
    organizationName?: string | null;
    communityId: string | null;
    communityName?: string | null;
    locationUnitId: string | null;
    locationUnitName?: string | null;
    locationUnitCode?: string | null;
    unitId: string | null;
  }>;
}

const ROLES = [
  'org_admin',
  'community_admin',
  'operator',
  'guard',
  'owner',
  'tenant',
  'resident',
  'staff',
];

const UNIT_TYPES = ['apartment', 'house', 'office', 'parking', 'storage'];

const PAGE_META: Record<string, { title: string; description: string }> = {
  dashboard: {
    title: 'Resumen',
    description: 'Vista general de la estructura y actividad de la plataforma.',
  },
  organizations: {
    title: 'Organizaciones',
    description: 'Organizaciones registradas y su estado.',
  },
  communities: {
    title: 'Comunidades',
    description: 'Comunidades agrupadas por organización.',
  },
  sections: {
    title: 'Secciones',
    description: 'Agrupadores de ubicación de cada comunidad.',
  },
  units: {
    title: 'Unidades',
    description: 'Unidades y espacios administrados por comunidad.',
  },
  invitations: {
    title: 'Invitaciones',
    description: 'Invitaciones enviadas, pendientes y revocadas.',
  },
  users: {
    title: 'Usuarios',
    description: 'Usuarios globales y sus membresías.',
  },
};

function EmptyRow({ colSpan, children }: { colSpan: number; children: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

export function PlatformPage() {
  const location = useLocation();
  const rawSection = location.pathname.split('/').pop() ?? 'organizations';
  const section = rawSection === 'platform' ? 'dashboard' : rawSection;
  const meta = PAGE_META[section] ?? PAGE_META.dashboard;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [formDialog, setFormDialog] = useState<string | null>(null);
  const [sectionSearch, setSectionSearch] = useState('');
  const [sectionTypeFilter, setSectionTypeFilter] = useState('all');
  const [sectionCommunityFilter, setSectionCommunityFilter] = useState('all');
  const [organizationSearch, setOrganizationSearch] = useState('');
  const [expandedOrganizationId, setExpandedOrganizationId] = useState<string | null>(null);
  const [organizationOverview, setOrganizationOverview] =
    useState<OrganizationOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [communitySearch, setCommunitySearch] = useState('');
  const [communityOrganizationFilter, setCommunityOrganizationFilter] = useState('all');
  const [unitSearch, setUnitSearch] = useState('');
  const [unitCommunityFilter, setUnitCommunityFilter] = useState('all');
  const [unitSectionFilter, setUnitSectionFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [structureTarget, setStructureTarget] = useState<{ id: string; name: string } | null>(null);
  const [structureFormOpen, setStructureFormOpen] = useState(false);

  const [orgForm, setOrgForm] = useState({ name: '', slug: '' });
  const [communityForm, setCommunityForm] = useState({
    organizationId: '',
    name: '',
    address: '',
    timezone: 'America/Bogota',
    slug: '',
  });
  const [buildingForm, setBuildingForm] = useState({
    communityId: '',
    name: '',
    code: '',
    sectionType: 'building',
    sectionTypeLabel: '',
  });
  const [unitForm, setUnitForm] = useState({
    communityId: '',
    buildingId: '',
    code: '',
    floor: '',
    type: 'apartment',
  });
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'resident',
    organizationId: '',
    communityId: '',
    unitId: '',
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orgs, comms, builds, us, invs, platUsers] = await Promise.all([
        get<{ data: Organization[] }>('/api/platform/organizations?pageSize=100'),
        get<{ data: Community[] }>('/api/platform/communities?pageSize=100'),
        get<{ data: Building[] }>('/api/sections?pageSize=100'),
        get<{ data: UnitApi[] }>('/api/units?pageSize=100'),
        get<Invitation[]>('/api/invitations'),
        get<{ data: PlatformUser[]; total: number }>('/api/platform/users?pageSize=100'),
      ]);
      setOrganizations(orgs.data.data);
      setCommunities(comms.data.data);
      setBuildings(builds.data.data);
      setUnits(
        us.data.data.map((unit) => ({
          ...unit,
          floor: unit.metadata?.legacyFloor ?? null,
          type: unit.metadata?.legacyType ?? 'apartment',
        })),
      );
      setInvitations(invs.data);
      setPlatformUsers(platUsers.data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando plataforma');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredBuildings = useMemo(() => {
    const term = sectionSearch.toLowerCase();
    return buildings.filter((building) => {
      const matchesSearch = !term
        ? true
        : `${building.name} ${building.code ?? ''} ${building.communityName}`
            .toLowerCase()
            .includes(term);
      const matchesType =
        sectionTypeFilter === 'all' || building.sectionType === sectionTypeFilter;
      const matchesCommunity =
        sectionCommunityFilter === 'all' || building.communityId === sectionCommunityFilter;
      return matchesSearch && matchesType && matchesCommunity;
    });
  }, [buildings, sectionSearch, sectionTypeFilter, sectionCommunityFilter]);

  const filteredPlatformUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return platformUsers;
    return platformUsers.filter((user) =>
      [
        user.email,
        user.name,
        ...user.memberships.flatMap((membership) => [
          membership.organizationName ?? '',
          membership.communityName ?? '',
        ]),
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [platformUsers, userSearch]);

  const filteredOrganizations = useMemo(() => {
    const term = organizationSearch.toLowerCase();
    if (!term) return organizations;
    return organizations.filter((organization) =>
      `${organization.name} ${organization.slug}`.toLowerCase().includes(term),
    );
  }, [organizations, organizationSearch]);

  const filteredCommunities = useMemo(() => {
    const term = communitySearch.toLowerCase();
    return communities.filter((community) => {
      const matchesSearch = !term
        ? true
        : `${community.name} ${community.slug} ${community.address} ${community.organizationName}`
            .toLowerCase()
            .includes(term);
      const matchesOrganization =
        communityOrganizationFilter === 'all' ||
        community.organizationId === communityOrganizationFilter;
      return matchesSearch && matchesOrganization;
    });
  }, [communities, communitySearch, communityOrganizationFilter]);

  const unitSectionOptions = useMemo(
    () =>
      buildings.filter(
        (building) =>
          unitCommunityFilter === 'all' || building.communityId === unitCommunityFilter,
      ),
    [buildings, unitCommunityFilter],
  );

  const filteredUnits = useMemo(() => {
    const term = unitSearch.toLowerCase();
    return units.filter((unit) => {
      const matchesSearch = !term
        ? true
        : `${unit.code} ${unit.sectionName} ${unit.communityName}`
            .toLowerCase()
            .includes(term);
      const matchesCommunity =
        unitCommunityFilter === 'all' || unit.communityId === unitCommunityFilter;
      const matchesSection =
        unitSectionFilter === 'all' || unit.sectionId === unitSectionFilter;
      return matchesSearch && matchesCommunity && matchesSection;
    });
  }, [units, unitSearch, unitCommunityFilter, unitSectionFilter]);

  async function toggleOrganizationOverview(id: string) {
    if (expandedOrganizationId === id) {
      setExpandedOrganizationId(null);
      setOrganizationOverview(null);
      return;
    }
    setExpandedOrganizationId(id);
    setOrganizationOverview(null);
    setOverviewLoading(true);
    try {
      const result = await get<OrganizationOverview>(
        `/api/platform/organizations/${id}/overview`,
      );
      setOrganizationOverview(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la organización.');
    } finally {
      setOverviewLoading(false);
    }
  }

  async function createOrganization(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await post('/api/platform/organizations', {
        name: orgForm.name,
        ...(orgForm.slug ? { slug: orgForm.slug } : {}),
      });
      setOrgForm({ name: '', slug: '' });
      loadAll();
    setFormDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando organización');
    }
  }

  async function createCommunity(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await post('/api/platform/communities', {
        organizationId: communityForm.organizationId,
        name: communityForm.name,
        address: communityForm.address,
        timezone: communityForm.timezone,
        ...(communityForm.slug ? { slug: communityForm.slug } : {}),
      });
      setCommunityForm({
        organizationId: communityForm.organizationId,
        name: '',
        address: '',
        timezone: communityForm.timezone,
        slug: '',
      });
      loadAll();
    setFormDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando comunidad');
    }
  }

  async function createBuilding(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await post('/api/sections', {
        communityId: buildingForm.communityId,
        name: buildingForm.name,
        code: buildingForm.code || null,
        sectionType: buildingForm.sectionType,
        sectionTypeLabel:
          buildingForm.sectionType === 'other' ? buildingForm.sectionTypeLabel : null,
      });
      setBuildingForm({
        communityId: buildingForm.communityId,
        name: '',
        code: '',
        sectionType: buildingForm.sectionType,
        sectionTypeLabel: '',
      });
      loadAll();
    setFormDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando sección');
    }
  }

  async function createUnit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await post('/api/units', {
        communityId: unitForm.communityId,
        sectionId: unitForm.buildingId,
        code: unitForm.code,
        floor: unitForm.floor ? Number(unitForm.floor) : null,
        type: unitForm.type,
      });
      setUnitForm({ communityId: unitForm.communityId, buildingId: unitForm.buildingId, code: '', floor: '', type: 'apartment' });
      loadAll();
    setFormDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando unidad');
    }
  }

  async function createInvitation(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInviteLink('');
    try {
      const { data } = await post<{ acceptUrl: string }>('/api/invitations', {
        email: inviteForm.email,
        role: inviteForm.role,
        organizationId: inviteForm.organizationId || undefined,
        communityId: inviteForm.communityId || null,
        locationUnitId: inviteForm.unitId || null,
      });
      setInviteLink(data.acceptUrl);
      setInviteForm({
        email: '',
        role: 'resident',
        organizationId: inviteForm.organizationId,
        communityId: inviteForm.communityId,
        unitId: inviteForm.unitId,
      });
      loadAll();
    setFormDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando invitación');
    }
  }

  async function revokeInvitation(id: string) {
    await patch(`/api/invitations/${id}/revoke`).catch(() => {});
    loadAll();
  }

  async function resendInvitation(id: string) {
    try {
      const { data } = await post<{ acceptUrl: string }>(`/api/invitations/${id}/resend`);
      setInviteLink(data.acceptUrl);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error reenviando invitación');
    }
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <PageHeader title={meta.title} description={meta.description} />

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={loadAll}>
                Reintentar
              </Button>
            </div>
          )}

          <Tabs value={section}>
        <TabsContent value="dashboard" className="space-y-4">
          <SectionCards
            items={[
              { label: 'Organizaciones', value: organizations.length, description: 'Clientes activos' },
              { label: 'Comunidades', value: communities.length, description: 'En todas las organizaciones' },
              { label: 'Secciones', value: buildings.length, description: 'Agrupadores de ubicación' },
              { label: 'Unidades', value: units.length, description: 'Espacios administrados' },
              { label: 'Invitaciones', value: invitations.length, description: 'Enviadas y pendientes' },
              { label: 'Usuarios', value: platformUsers.length, description: 'Membresías globales' },
            ]}
          />
        </TabsContent>

        <TabsContent value="organizations" className="space-y-4">
          <FormDialog
            open={formDialog === 'organizations'}
            onOpenChange={(open) => setFormDialog(open ? 'organizations' : null)}
            title="Nueva organización"
            description="Creá una organización para agrupar comunidades."
            triggerLabel="Crear organización"
          >
<form onSubmit={createOrganization} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Slug (opcional)</Label>
              <Input value={orgForm.slug} onChange={(e) => setOrgForm({ ...orgForm, slug: e.target.value })} />
            </div>
            <Button type="submit">Crear organización</Button>
          </form>
          </FormDialog>
          <ListToolbar
            search={organizationSearch}
            onSearchChange={setOrganizationSearch}
            placeholder="Buscar organización…"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrganizations.length === 0 && (
                <EmptyRow colSpan={3}>No hay organizaciones para mostrar</EmptyRow>
              )}
              {filteredOrganizations.map((o) => (
                <Fragment key={o.id}>
                  <TableRow>
                    <TableCell>{o.name}</TableCell>
                    <TableCell className="font-mono text-xs">{o.slug}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleOrganizationOverview(o.id)}
                        aria-expanded={expandedOrganizationId === o.id}
                      >
                        {expandedOrganizationId === o.id ? 'Ocultar detalle' : 'Ver detalle'}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedOrganizationId === o.id && (
                    <TableRow>
                      <TableCell colSpan={3} className="bg-muted/30">
                        {overviewLoading ? (
                          <Skeleton className="h-24 w-full" />
                        ) : organizationOverview ? (
                          <div className="grid gap-4 py-2 md:grid-cols-3">
                            <div className="space-y-1 text-sm">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Organización
                              </p>
                              <p>{organizationOverview.organization.name}</p>
                              <p>NIT: {organizationOverview.organization.nit ?? 'Sin completar'}</p>
                              <p>Teléfono: {organizationOverview.organization.phone ?? 'Sin completar'}</p>
                              <p>Dirección: {organizationOverview.organization.address ?? 'Sin completar'}</p>
                              <p className="text-muted-foreground">
                                {organizationOverview.organization.welcomeMessage ?? 'Sin mensaje de bienvenida'}
                              </p>
                            </div>
                            <div className="space-y-1 text-sm">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Representante legal
                              </p>
                              {organizationOverview.legalRepresentative ? (
                                <>
                                  <p>
                                    {organizationOverview.legalRepresentative.firstName}{' '}
                                    {organizationOverview.legalRepresentative.lastName}
                                  </p>
                                  <p>
                                    {organizationOverview.legalRepresentative.documentType ?? 'Documento'}{' '}
                                    {organizationOverview.legalRepresentative.documentNumber ?? 'Sin completar'}
                                  </p>
                                  <p>{organizationOverview.legalRepresentative.phone ?? 'Sin teléfono'}</p>
                                  <p>{organizationOverview.legalRepresentative.contactEmail ?? 'Sin correo'}</p>
                                </>
                              ) : (
                                <p className="text-muted-foreground">Sin completar</p>
                              )}
                            </div>
                            <div className="space-y-1 text-sm">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Administrador
                              </p>
                              {organizationOverview.administrator ? (
                                <>
                                  <p>{organizationOverview.administrator.name}</p>
                                  <p>{organizationOverview.administrator.email}</p>
                                  <p>{organizationOverview.administrator.status}</p>
                                </>
                              ) : organizationOverview.pendingAdministrator ? (
                                <>
                                  <p>{organizationOverview.pendingAdministrator.email}</p>
                                  <p className="text-muted-foreground">Invitación pendiente</p>
                                </>
                              ) : (
                                <p className="text-muted-foreground">Sin administrador</p>
                              )}
                              <p className="pt-2 text-xs text-muted-foreground">
                                {organizationOverview.communities.length} comunidades
                              </p>
                              <div className="space-y-1 pt-1">
                                {organizationOverview.communities.map((community) => (
                                  <p key={community.id} className="text-xs">
                                    {community.name}: {community.sectionCount} secciones ·{' '}
                                    {community.unitCount} unidades
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="py-3 text-sm text-muted-foreground">
                            No se pudo cargar el detalle.
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="communities" className="space-y-4">
          <FormDialog
            open={formDialog === 'communities'}
            onOpenChange={(open) => setFormDialog(open ? 'communities' : null)}
            title="Nueva comunidad"
            description="Asociá una comunidad a una organización existente."
            triggerLabel="Crear comunidad"
            hidden
          >
<form onSubmit={createCommunity} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Organización</Label>
              <select
                className="h-9 rounded border border-border bg-card px-2 text-sm"
                value={communityForm.organizationId}
                onChange={(e) => setCommunityForm({ ...communityForm, organizationId: e.target.value })}
                required
              >
                <option value="">Elegir…</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={communityForm.name} onChange={(e) => setCommunityForm({ ...communityForm, name: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Dirección</Label>
              <Input value={communityForm.address} onChange={(e) => setCommunityForm({ ...communityForm, address: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Zona horaria</Label>
              <Input value={communityForm.timezone} onChange={(e) => setCommunityForm({ ...communityForm, timezone: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Slug (opcional)</Label>
              <Input value={communityForm.slug} onChange={(e) => setCommunityForm({ ...communityForm, slug: e.target.value })} />
            </div>
            <Button type="submit">Crear comunidad</Button>
          </form>
          </FormDialog>
          <ListToolbar
            search={communitySearch}
            onSearchChange={setCommunitySearch}
            placeholder="Buscar comunidad…"
          >
            <select
              className="h-9 rounded border border-border bg-card px-2 text-sm"
              value={communityOrganizationFilter}
              onChange={(event) => setCommunityOrganizationFilter(event.target.value)}
              aria-label="Filtrar por organización"
            >
              <option value="all">Todas las organizaciones</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </ListToolbar>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Organización</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCommunities.length === 0 && (
                <EmptyRow colSpan={4}>No hay comunidades para mostrar</EmptyRow>
              )}
              {filteredCommunities.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                  <TableCell>{c.organizationName}</TableCell>
                  <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <FormDialog
            open={formDialog === 'sections'}
            onOpenChange={(open) => setFormDialog(open ? 'sections' : null)}
            title="Nueva sección"
            description="Creá una sección dentro de una comunidad."
            triggerLabel="Crear sección"
            hidden
          >
<form onSubmit={createBuilding} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Comunidad</Label>
              <select
                className="h-9 rounded border border-border bg-card px-2 text-sm"
                value={buildingForm.communityId}
                onChange={(e) => setBuildingForm({ ...buildingForm, communityId: e.target.value })}
                required
              >
                <option value="">Elegir…</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={buildingForm.name} onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Código</Label>
              <Input value={buildingForm.code} onChange={(e) => setBuildingForm({ ...buildingForm, code: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <select
                className="h-9 rounded border border-border bg-card px-2 text-sm"
                value={buildingForm.sectionType}
                onChange={(e) => setBuildingForm({ ...buildingForm, sectionType: e.target.value })}
              >
                {Object.entries(SECTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            {buildingForm.sectionType === 'other' && (
              <div className="space-y-1">
                <Label>Tipo personalizado</Label>
                <Input
                  value={buildingForm.sectionTypeLabel}
                  onChange={(e) => setBuildingForm({ ...buildingForm, sectionTypeLabel: e.target.value })}
                  required
                />
              </div>
            )}
            <Button type="submit">Crear sección</Button>
          </form>
          </FormDialog>
          <FormDialog
            open={structureFormOpen}
            onOpenChange={setStructureFormOpen}
            title="Nueva estructura"
            description="Definí los niveles de la jerarquía de esta comunidad."
            triggerLabel="Nueva estructura"
            hidden
          >
            <StructureForm
              communities={communities}
              onSaved={() => setStructureFormOpen(false)}
            />
          </FormDialog>
          <ListToolbar
            search={sectionSearch}
            onSearchChange={setSectionSearch}
            placeholder="Buscar sección…"
          >
            <select
              className="h-9 rounded border border-border bg-card px-2 text-sm"
              value={sectionCommunityFilter}
              onChange={(event) => setSectionCommunityFilter(event.target.value)}
              aria-label="Filtrar por comunidad"
            >
              <option value="all">Todas las comunidades</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded border border-border bg-card px-2 text-sm"
              value={sectionTypeFilter}
              onChange={(event) => setSectionTypeFilter(event.target.value)}
              aria-label="Filtrar por tipo de sección"
            >
              <option value="all">Todos los tipos</option>
              {Object.entries(SECTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </ListToolbar>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Comunidad</TableHead>
                <TableHead>Niveles</TableHead>
                <TableHead>Unidades</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBuildings.length === 0 && (
                <EmptyRow colSpan={8}>No hay secciones para mostrar</EmptyRow>
              )}
              {filteredBuildings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {sectionTypeLabel(b.sectionType, b.sectionTypeLabel)}
                    </Badge>
                  </TableCell>
                  <TableCell>{b.communityName}</TableCell>
                  <TableCell>{b.levelCount}</TableCell>
                  <TableCell>{b.unitCount ?? 0}</TableCell>
                  <TableCell className="font-mono text-xs">{b.code ?? '—'}</TableCell>
                  <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setStructureTarget({ id: b.communityId, name: b.communityName })
                      }
                    >
                      Ver estructura
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="units" className="space-y-4">
          <FormDialog
            open={formDialog === 'units'}
            onOpenChange={(open) => setFormDialog(open ? 'units' : null)}
            title="Nueva unidad"
            description="Creá una unidad dentro de una sección."
            triggerLabel="Crear unidad"
            hidden
          >
<form onSubmit={createUnit} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Comunidad</Label>
              <select
                className="h-9 rounded border border-border bg-card px-2 text-sm"
                value={unitForm.communityId}
                onChange={(e) => setUnitForm({ ...unitForm, communityId: e.target.value, buildingId: '' })}
                required
              >
                <option value="">Elegir…</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Sección</Label>
              <select
                className="h-9 rounded border border-border bg-card px-2 text-sm"
                value={unitForm.buildingId}
                onChange={(e) => setUnitForm({ ...unitForm, buildingId: e.target.value })}
              >
                <option value="">Sin sección</option>
                {buildings.filter((b) => b.communityId === unitForm.communityId).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Código</Label>
              <Input value={unitForm.code} onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Piso</Label>
              <Input type="number" value={unitForm.floor} onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <select
                className="h-9 rounded border border-border bg-card px-2 text-sm"
                value={unitForm.type}
                onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value })}
              >
                {UNIT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <Button type="submit">Crear unidad</Button>
          </form>
          </FormDialog>
          <ListToolbar
            search={unitSearch}
            onSearchChange={setUnitSearch}
            placeholder="Buscar unidad…"
          >
            <select
              className="h-9 rounded border border-border bg-card px-2 text-sm"
              value={unitCommunityFilter}
              onChange={(event) => {
                setUnitCommunityFilter(event.target.value);
                setUnitSectionFilter('all');
              }}
              aria-label="Filtrar por comunidad"
            >
              <option value="all">Todas las comunidades</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded border border-border bg-card px-2 text-sm"
              value={unitSectionFilter}
              onChange={(event) => setUnitSectionFilter(event.target.value)}
              aria-label="Filtrar por sección"
            >
              <option value="all">Todas las secciones</option>
              {unitSectionOptions.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </ListToolbar>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Sección</TableHead>
                <TableHead>Comunidad</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Piso</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUnits.length === 0 && (
                <EmptyRow colSpan={6}>No hay unidades para mostrar</EmptyRow>
              )}
              {filteredUnits.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.code}</TableCell>
                  <TableCell>{u.path || u.sectionName || 'Sin sección'}</TableCell>
                  <TableCell>{u.communityName}</TableCell>
                  <TableCell>{u.type}</TableCell>
                  <TableCell>{u.floor ?? '—'}</TableCell>
                  <TableCell><Badge variant="outline">{u.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <ListToolbar
            search={userSearch}
            onSearchChange={setUserSearch}
            placeholder="Buscar por email, persona, organización o comunidad…"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Organización</TableHead>
                <TableHead>Comunidad / unidad</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Platform admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlatformUsers.length === 0 && (
                <EmptyRow colSpan={7}>No hay usuarios para mostrar</EmptyRow>
              )}
              {filteredPlatformUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell className="text-xs">
                    {[...new Set(u.memberships.map((m) => m.organizationName).filter(Boolean))]
                      .join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {u.memberships
                      .map((m) =>
                        [
                          m.communityName,
                          m.locationUnitName ?? m.locationUnitCode,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      )
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {u.memberships.map((m) => m.role).join(', ') || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.active ? 'default' : 'outline'}>
                      {u.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isPlatformAdmin ? 'default' : 'outline'}>
                      {u.isPlatformAdmin ? 'Sí' : 'No'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <FormDialog
            open={formDialog === 'invitations'}
            onOpenChange={(open) => setFormDialog(open ? 'invitations' : null)}
            title="Nueva invitación"
            description="Invitá a una persona a la plataforma."
            triggerLabel="Invitar"
          >
<form onSubmit={createInvitation} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Rol</Label>
              <select
                className="h-9 rounded border border-border bg-card px-2 text-sm"
                value={inviteForm.role}
                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Organización</Label>
              <select
                className="h-9 rounded border border-border bg-card px-2 text-sm"
                value={inviteForm.organizationId}
                onChange={(e) => setInviteForm({ ...inviteForm, organizationId: e.target.value, communityId: '', unitId: '' })}
                required
              >
                <option value="">Elegir…</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Comunidad</Label>
              <select
                className="h-9 rounded border border-border bg-card px-2 text-sm"
                value={inviteForm.communityId}
                onChange={(e) => setInviteForm({ ...inviteForm, communityId: e.target.value, unitId: '' })}
              >
                <option value="">Sin comunidad</option>
                {communities.filter((c) => c.organizationId === inviteForm.organizationId).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Unidad</Label>
              <select
                className="h-9 rounded border border-border bg-card px-2 text-sm"
                value={inviteForm.unitId}
                onChange={(e) => setInviteForm({ ...inviteForm, unitId: e.target.value })}
              >
                <option value="">Sin unidad</option>
                {units.filter((u) => u.communityId === inviteForm.communityId).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.path || u.sectionName} · {u.code}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Invitar</Button>
          </form>
          </FormDialog>

          {inviteLink && (
            <div className="flex items-center gap-2 rounded border border-border bg-muted/40 p-2">
              <code className="text-xs break-all flex-1">{inviteLink}</code>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(inviteLink)}>
                Copiar
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.length === 0 && (
                <EmptyRow colSpan={5}>No hay invitaciones para mostrar</EmptyRow>
              )}
              {invitations.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.email}</TableCell>
                  <TableCell>{i.role}</TableCell>
                  <TableCell><Badge variant="outline">{i.status}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(i.expiresAt).toLocaleDateString()}</TableCell>
                  <TableCell className="space-x-2">
                    {i.status === 'pending' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => resendInvitation(i.id)}>Reenviar</Button>
                        <Button size="sm" variant="outline" onClick={() => revokeInvitation(i.id)}>Revocar</Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
          </Tabs>
        </>
      )}

      {structureTarget && (
        <StructureTreeDialog
          communityId={structureTarget.id}
          communityName={structureTarget.name}
          open
          onOpenChange={(open) => {
            if (!open) setStructureTarget(null);
          }}
        />
      )}
    </div>
  );
}
