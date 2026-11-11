import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RiArrowDownSLine, RiArrowRightSLine } from '@remixicon/react';
import { assetObjectUrl, get, patch, post, upload } from '../../lib/apiClient';
import { PageHeader } from '../layout/PageHeader';
import { ListToolbar } from '../layout/ListToolbar';
import { Pagination } from '../layout/Pagination';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { SectionCards } from '../layout/SectionCards';
import { ChartAreaInteractive } from '../layout/ChartAreaInteractive';
import { StructureTreeDialog } from '../layout/StructureTreeDialog';
import { StructureForm } from '../layout/StructureForm';
import { FormDialog } from '../layout/FormDialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { SECTION_TYPE_LABELS, sectionTypeLabel } from '../../lib/section-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { UsersTable } from './UsersTable';
import { CallHistoryTable } from './CallHistoryTable';
import { DetailField, DetailGrid } from '../ui/detail-field';
import { LogoUpload } from '../ui/logo-upload';
import { expandableRowProps, useExpandedRow } from '../../lib/use-expanded-row';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../lib/countries';
import { useWorkspace } from '../../contexts/WorkspaceContext';

interface Community {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  type: string | null;
  typeLabel: string | null;
  welcomeMessage: string | null;
  logoAssetId: string | null;
  administratorEmail: string | null;
  status: string;
}

interface StructureSummary {
  structureId: string;
  levelCount: number;
  levelNames: {
    level1: string;
    level2: string | null;
    level3: string | null;
  };
  level1Count: number;
  level2Count: number;
  leafCount: number;
  uniform: boolean;
  perLevel1: Array<{
    id: string;
    name: string;
    code: string | null;
    level2Count: number;
    leafCount: number;
  }>;
  perLevel2: Array<{
    level1Id: string;
    level1Name: string;
    level2Id: string;
    level2Name: string;
    leafCount: number;
  }>;
}

interface CommunityOverview {
  community: {
    latitude: string | null;
    longitude: string | null;
    timezone: string | null;
    municipality: string | null;
    department: string | null;
    country: string | null;
  };
  structureSummary: StructureSummary | null;
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word.toLowerCase() : `${word.toLowerCase()}s`;
}

function singularize(word: string): string {
  const lower = word.toLowerCase();
  return lower.endsWith('s') ? lower.slice(0, -1) : lower;
}

function formatStructureSummary(summary: StructureSummary | null): string {
  if (!summary) return 'Sin estructura definida';

  const level1 = pluralize(summary.levelNames.level1, summary.level1Count);
  const level2Name = summary.levelNames.level2;
  const level3Name = summary.levelNames.level3;

  if (summary.levelCount === 1) {
    return `${summary.level1Count} ${level1}. ${summary.leafCount} unidades en total.`;
  }

  if (summary.uniform) {
    const level2PerLevel1 = summary.perLevel1[0]?.level2Count ?? 0;
    const level2 = level2Name ? pluralize(level2Name, level2PerLevel1) : 'niveles';

    if (summary.levelCount === 2) {
      return `${summary.level1Count} ${level1} de ${level2PerLevel1} ${level2}. ${summary.leafCount} unidades en total.`;
    }

    const level3PerLevel2 = summary.perLevel2[0]?.leafCount ?? 0;
    const level3 = level3Name ? pluralize(level3Name, level3PerLevel2) : 'unidades';
    const level2Singular = level2Name ? singularize(level2Name) : 'nivel';

    return `${summary.level1Count} ${level1} de ${level2PerLevel1} ${level2}, ${level3PerLevel2} ${level3} por ${level2Singular}. ${summary.leafCount} ${level3} en total.`;
  }

  const level2 = level2Name ? pluralize(level2Name, summary.level2Count) : 'niveles';
  return `${summary.level1Count} ${level1} · ${summary.level2Count} ${level2} · ${summary.leafCount} unidades`;
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
  path: string;
  code: string;
  floor: number | null;
  type: string;
  status: string;
  communityName: string;
  sectionName: string;
}

interface UnitApi extends Omit<Unit, 'floor' | 'type'> {
  metadata: { legacyFloor?: number; legacyType?: string } | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  organizationId: string;
  communityId: string | null;
  unitId: string | null;
  expiresAt: string;
}

function CommunityLogoField({
  community,
  onSelect,
}: {
  community: Community;
  onSelect: (file: File) => Promise<void>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    async function load() {
      if (!community.logoAssetId) {
        setUrl(null);
        return;
      }
      objectUrl = await assetObjectUrl(community.logoAssetId);
      if (!cancelled) setUrl(objectUrl);
    }
    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [community.logoAssetId]);

  async function handleSelect(file: File) {
    setUploading(true);
    try {
      await onSelect(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <LogoUpload
      id={`community-logo-${community.id}`}
      label="Logo de la comunidad"
      previewUrl={url}
      hasLogo={Boolean(community.logoAssetId)}
      onSelect={handleSelect}
      disabled={uploading}
      hint="PNG, JPG o WEBP. Máximo 500 KB."
    />
  );
}

const pageSize = 10;

const emptyCommunityForm = {
  name: '',
  address: '',
  municipality: '',
  department: '',
  country: DEFAULT_COUNTRY,
  phone: '',
  type: 'conjunto',
  typeLabel: '',
  latitude: '',
  longitude: '',
  welcomeMessage: '',
  timezone: 'America/Bogota',
  slug: '',
};

const sectionMeta: Record<string, { title: string; description: string }> = {
  dashboard: {
    title: 'Resumen',
    description: 'Vista general de tu organización o comunidad.',
  },
  communities: {
    title: 'Comunidades',
    description: 'Comunidades dentro de tu alcance.',
  },
  sections: {
    title: 'Secciones',
    description: 'Secciones y agrupadores de ubicación.',
  },
  units: {
    title: 'Unidades',
    description: 'Unidades y espacios administrados.',
  },
  invitations: {
    title: 'Invitaciones',
    description: 'Invitaciones enviadas, pendientes y revocadas.',
  },
  users: {
    title: 'Usuarios',
    description: 'Usuarios y membresías dentro de tu alcance.',
  },
  calls: {
    title: 'Llamadas',
    description: 'Llamadas registradas, estado y duración.',
  },
};

export function AdminPanel() {
  const location = useLocation();
  const { refresh: refreshWorkspace } = useWorkspace();
  const rawSection = location.pathname.split('/').pop() ?? 'dashboard';
  const section = rawSection === 'admin' ? 'dashboard' : rawSection;
  const meta = sectionMeta[section] ?? sectionMeta.dashboard;

  const [communities, setCommunities] = useState<Community[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [communityFilter, setCommunityFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [structureTarget, setStructureTarget] = useState<{ id: string; name: string } | null>(null);
  const [structureFormOpen, setStructureFormOpen] = useState(false);
  const [communityFormOpen, setCommunityFormOpen] = useState(false);
  const communityRow = useExpandedRow();
  const [editingCommunityId, setEditingCommunityId] = useState<string | null>(null);
  const [communityOverviews, setCommunityOverviews] = useState<Record<string, CommunityOverview>>(
    {},
  );
  const [overviewLoadingId, setOverviewLoadingId] = useState<string | null>(null);
  const [communityForm, setCommunityForm] = useState({ ...emptyCommunityForm });
  const [communitySaving, setCommunitySaving] = useState(false);
  const [adminInviteCommunity, setAdminInviteCommunity] = useState<Community | null>(null);
  const [adminInviteEmail, setAdminInviteEmail] = useState('');
  const [adminInviteLink, setAdminInviteLink] = useState('');
  const [adminInviteSaving, setAdminInviteSaving] = useState(false);
  const [adminInviteError, setAdminInviteError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [communityResult, sectionResult, unitResult, invitationResult, userResult] =
        await Promise.all([
          get<Community[]>('/api/communities'),
          get<{ data: Building[] }>('/api/sections?pageSize=100'),
          get<{ data: UnitApi[] }>('/api/units?pageSize=100'),
          get<Invitation[]>('/api/invitations'),
          get<{ total: number }>('/api/users?page=1&pageSize=1'),
        ]);

      const communityList = communityResult.data;
      const buildingList = sectionResult.data.data;
      const unitList = unitResult.data.data.map((unit) => ({
        ...unit,
        floor: unit.metadata?.legacyFloor ?? null,
        type: unit.metadata?.legacyType ?? 'apartment',
      }));

      setCommunities(communityList);
      setBuildings(buildingList);
      setUnits(unitList);
      setInvitations(invitationResult.data);
      setUserTotal(userResult.data.total);
    } catch {
      setError('No se pudo cargar la información. Reintentá en unos segundos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleCommunity(community: Community) {
    if (communityRow.isExpanded(community.id)) {
      communityRow.collapse();
      return;
    }
    communityRow.toggle(community.id);
    if (communityOverviews[community.id]) return;

    setOverviewLoadingId(community.id);
    try {
      const result = await get<CommunityOverview>(`/api/communities/${community.id}/overview`);
      setCommunityOverviews((current) => ({
        ...current,
        [community.id]: result.data,
      }));
    } catch {
      setError('No se pudo cargar el detalle de la comunidad.');
    } finally {
      setOverviewLoadingId(null);
    }
  }

  useEffect(() => {
    setSearch('');
    setCommunityFilter('all');
    setSectionFilter('all');
    setTypeFilter('all');
    setStatusFilter('all');
    setPage(1);
  }, [section]);

  useEffect(() => {
    setPage(1);
  }, [search, communityFilter, sectionFilter, typeFilter, statusFilter]);

  const filteredCommunities = useMemo(
    () =>
      communities.filter((community) =>
        `${community.name} ${community.address}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [communities, search],
  );

  const filteredSections = useMemo(
    () =>
      buildings.filter((building) => {
        const matchesSearch = `${building.name} ${building.code ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesCommunity =
          communityFilter === 'all' || building.communityId === communityFilter;
        const matchesType = typeFilter === 'all' || building.sectionType === typeFilter;
        return matchesSearch && matchesCommunity && matchesType;
      }),
    [buildings, search, communityFilter, typeFilter],
  );

  const filteredUnits = useMemo(
    () =>
      units.filter((unit) => {
        const matchesSearch = unit.code.toLowerCase().includes(search.toLowerCase());
        const matchesCommunity = communityFilter === 'all' || unit.communityId === communityFilter;
        const matchesSection = sectionFilter === 'all' || unit.sectionId === sectionFilter;
        return matchesSearch && matchesCommunity && matchesSection;
      }),
    [units, search, communityFilter, sectionFilter],
  );

  const filteredInvitations = useMemo(
    () =>
      invitations.filter((invitation) => {
        const matchesSearch = invitation.email.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' || invitation.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [invitations, search, statusFilter],
  );

  const sectionOptions = buildings.filter(
    (building) => communityFilter === 'all' || building.communityId === communityFilter,
  );

  async function revokeInvitation(id: string) {
    setError('');
    try {
      await patch(`/api/invitations/${id}/revoke`);
      setInvitations((current) =>
        current.map((invitation) =>
          invitation.id === id ? { ...invitation, status: 'revoked' } : invitation,
        ),
      );
    } catch {
      setError('No se pudo revocar la invitación.');
    }
  }

  async function uploadCommunityLogo(community: Community, file: File) {
    setError('');
    try {
      const formData = new FormData();
      formData.append('kind', 'community_logo');
      formData.append('communityId', community.id);
      formData.append('file', file);
      const asset = await upload<{ id: string }>('/api/assets', formData);
      await patch(`/api/communities/${community.id}`, {
        logoAssetId: asset.data.id,
      });
      await load();
      refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el logo.');
    }
  }

  async function inviteCommunityAdmin(event: React.FormEvent) {
    event.preventDefault();
    if (!adminInviteCommunity) return;
    setAdminInviteSaving(true);
    setAdminInviteError('');
    setAdminInviteLink('');
    try {
      const response = await post<{ acceptUrl: string }>('/api/invitations', {
        email: adminInviteEmail,
        role: 'community_admin',
        communityId: adminInviteCommunity.id,
      });
      setAdminInviteLink(response.data.acceptUrl);
      setAdminInviteEmail('');
      await load();
    } catch (err) {
      setAdminInviteError(err instanceof Error ? err.message : 'No se pudo crear la invitación.');
    } finally {
      setAdminInviteSaving(false);
    }
  }

  function openCommunityCreate() {
    setEditingCommunityId(null);
    setCommunityForm({ ...emptyCommunityForm });
    setCommunityFormOpen(true);
  }

  async function openCommunityEdit(community: Community) {
    setEditingCommunityId(community.id);
    setCommunityForm({
      name: community.name,
      address: community.address,
      municipality: '',
      department: '',
      country: DEFAULT_COUNTRY,
      phone: community.phone ?? '',
      type: community.type ?? 'conjunto',
      typeLabel: community.typeLabel ?? '',
      latitude: '',
      longitude: '',
      welcomeMessage: community.welcomeMessage ?? '',
      timezone: '',
      slug: '',
    });
    setCommunityFormOpen(true);

    try {
      const result = await get<CommunityOverview>(`/api/communities/${community.id}/overview`);
      setCommunityOverviews((current) => ({
        ...current,
        [community.id]: result.data,
      }));
      setCommunityForm((current) => ({
        ...current,
        latitude: result.data.community.latitude ?? '',
        longitude: result.data.community.longitude ?? '',
        timezone: result.data.community.timezone ?? '',
        municipality: result.data.community.municipality ?? '',
        department: result.data.community.department ?? '',
        country: result.data.community.country ?? '',
      }));
    } catch {
      setError('No se pudieron cargar los datos de la comunidad.');
    }
  }

  async function saveCommunity(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setCommunitySaving(true);
    const payload = {
      name: communityForm.name,
      address: communityForm.address,
      municipality: communityForm.municipality || null,
      department: communityForm.department || null,
      country: communityForm.country || null,
      phone: communityForm.phone || null,
      type: communityForm.type,
      typeLabel: communityForm.type === 'otro' ? communityForm.typeLabel || null : null,
      latitude: communityForm.latitude ? Number(communityForm.latitude) : null,
      longitude: communityForm.longitude ? Number(communityForm.longitude) : null,
      welcomeMessage: communityForm.welcomeMessage || null,
      ...(communityForm.timezone ? { timezone: communityForm.timezone } : {}),
      ...(communityForm.slug ? { slug: communityForm.slug } : {}),
    };
    try {
      if (editingCommunityId) {
        await patch(`/api/communities/${editingCommunityId}`, payload);
      } else {
        await post('/api/organizations/me/communities', payload);
      }
      setCommunityForm({ ...emptyCommunityForm });
      setEditingCommunityId(null);
      setCommunityFormOpen(false);
      await load();
      refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la comunidad.');
    } finally {
      setCommunitySaving(false);
    }
  }

  function paginate<T>(items: T[]) {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    return {
      items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
      totalPages,
      currentPage,
    };
  }

  if (section === 'users') {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={meta.title} description={meta.description} />
        <UsersTable />
      </div>
    );
  }

  if (section === 'calls') {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={meta.title} description={meta.description} />
        <CallHistoryTable />
      </div>
    );
  }

  const communitiesPage = paginate(filteredCommunities);
  const sectionsPage = paginate(filteredSections);
  const unitsPage = paginate(filteredUnits);
  const invitationsPage = paginate(filteredInvitations);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={meta.title} description={meta.description} />

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>
            Reintentar
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          {section === 'dashboard' && (
            <div className="space-y-4">
              <SectionCards
                items={[
                  {
                    label: 'Comunidades',
                    value: communities.length,
                    description: 'Dentro de tu alcance',
                  },
                  {
                    label: 'Secciones',
                    value: buildings.length,
                    description: 'Agrupadores de ubicación',
                  },
                  { label: 'Unidades', value: units.length, description: 'Espacios administrados' },
                  {
                    label: 'Invitaciones',
                    value: invitations.length,
                    description: 'Enviadas y pendientes',
                  },
                  { label: 'Usuarios', value: userTotal, description: 'Membresías activas' },
                ]}
              />
              <ChartAreaInteractive />
            </div>
          )}

          {section === 'communities' && (
            <>
              <FormDialog
                open={communityFormOpen}
                onOpenChange={(open) => {
                  setCommunityFormOpen(open);
                  if (!open) setEditingCommunityId(null);
                }}
                title={editingCommunityId ? 'Editar comunidad' : 'Nueva comunidad'}
                description={
                  editingCommunityId
                    ? 'Actualizá los datos de la comunidad.'
                    : 'Creá una comunidad dentro de tu organización.'
                }
                hideTrigger
              >
                <form onSubmit={saveCommunity} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="admin-community-name">Nombre</Label>
                    <Input
                      id="admin-community-name"
                      value={communityForm.name}
                      onChange={(event) =>
                        setCommunityForm({ ...communityForm, name: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-community-address">Dirección</Label>
                    <Input
                      id="admin-community-address"
                      value={communityForm.address}
                      onChange={(event) =>
                        setCommunityForm({ ...communityForm, address: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="admin-community-municipality">Municipio</Label>
                      <Input
                        id="admin-community-municipality"
                        value={communityForm.municipality}
                        onChange={(event) =>
                          setCommunityForm({ ...communityForm, municipality: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="admin-community-department">Departamento</Label>
                      <Input
                        id="admin-community-department"
                        value={communityForm.department}
                        onChange={(event) =>
                          setCommunityForm({ ...communityForm, department: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="admin-community-country">País</Label>
                      <select
                        id="admin-community-country"
                        className="h-9 w-full rounded border border-border bg-card px-2 text-sm"
                        value={communityForm.country}
                        onChange={(event) =>
                          setCommunityForm({ ...communityForm, country: event.target.value })
                        }
                      >
                        <option value="">Sin especificar</option>
                        {COUNTRIES.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-community-phone">Teléfono</Label>
                    <Input
                      id="admin-community-phone"
                      value={communityForm.phone}
                      onChange={(event) =>
                        setCommunityForm({ ...communityForm, phone: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-community-type">Tipo</Label>
                    <select
                      id="admin-community-type"
                      className="h-9 w-full rounded border border-border bg-card px-2 text-sm"
                      value={communityForm.type}
                      onChange={(event) =>
                        setCommunityForm({ ...communityForm, type: event.target.value })
                      }
                    >
                      <option value="conjunto">Conjunto</option>
                      <option value="condominio">Condominio</option>
                      <option value="club">Club</option>
                      <option value="hotel">Hotel</option>
                      <option value="edificio">Edificio</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  {communityForm.type === 'otro' && (
                    <div className="space-y-1">
                      <Label htmlFor="admin-community-type-label">Tipo personalizado</Label>
                      <Input
                        id="admin-community-type-label"
                        value={communityForm.typeLabel}
                        onChange={(event) =>
                          setCommunityForm({
                            ...communityForm,
                            typeLabel: event.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="admin-community-latitude">Latitud</Label>
                      <Input
                        id="admin-community-latitude"
                        type="number"
                        step="0.000001"
                        value={communityForm.latitude}
                        onChange={(event) =>
                          setCommunityForm({
                            ...communityForm,
                            latitude: event.target.value,
                          })
                        }
                        placeholder="4.711"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="admin-community-longitude">Longitud</Label>
                      <Input
                        id="admin-community-longitude"
                        type="number"
                        step="0.000001"
                        value={communityForm.longitude}
                        onChange={(event) =>
                          setCommunityForm({
                            ...communityForm,
                            longitude: event.target.value,
                          })
                        }
                        placeholder="-74.0721"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-community-welcome">Mensaje de bienvenida</Label>
                    <Input
                      id="admin-community-welcome"
                      value={communityForm.welcomeMessage}
                      onChange={(event) =>
                        setCommunityForm({
                          ...communityForm,
                          welcomeMessage: event.target.value,
                        })
                      }
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-community-timezone">Zona horaria</Label>
                    <Input
                      id="admin-community-timezone"
                      value={communityForm.timezone}
                      onChange={(event) =>
                        setCommunityForm({ ...communityForm, timezone: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-community-slug">Slug (opcional)</Label>
                    <Input
                      id="admin-community-slug"
                      value={communityForm.slug}
                      onChange={(event) =>
                        setCommunityForm({ ...communityForm, slug: event.target.value })
                      }
                    />
                  </div>
                  <Button type="submit" disabled={communitySaving}>
                    {communitySaving
                      ? 'Guardando…'
                      : editingCommunityId
                        ? 'Guardar cambios'
                        : 'Crear comunidad'}
                  </Button>
                </form>
              </FormDialog>
              <ListToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="Buscar comunidad…"
                actions={<Button onClick={openCommunityCreate}>Crear comunidad</Button>}
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {communitiesPage.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          No hay comunidades para mostrar
                        </TableCell>
                      </TableRow>
                    )}
                    {communitiesPage.items.map((community) => {
                      const isExpanded = communityRow.isExpanded(community.id);
                      return (
                        <Fragment key={community.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/40"
                            {...expandableRowProps(
                              community.id,
                              isExpanded,
                              () => void toggleCommunity(community),
                            )}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <RiArrowDownSLine className="size-4 text-muted-foreground" />
                                ) : (
                                  <RiArrowRightSLine className="size-4 text-muted-foreground" />
                                )}
                                {community.name}
                              </div>
                            </TableCell>
                            <TableCell>{community.address}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{community.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void openCommunityEdit(community);
                                  }}
                                >
                                  Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setAdminInviteCommunity(community);
                                    setAdminInviteEmail('');
                                    setAdminInviteLink('');
                                    setAdminInviteError('');
                                  }}
                                >
                                  Invitar admin
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setStructureTarget({
                                      id: community.id,
                                      name: community.name,
                                    });
                                  }}
                                >
                                  Ver estructura
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={4} className="bg-muted/30">
                                <div className="space-y-4 py-2">
                                  <DetailGrid>
                                    <DetailField
                                      label="Nombre"
                                      value={community.name}
                                      valueClassName="text-base font-bold"
                                    />
                                    <DetailField
                                      label="Tipo"
                                      value={community.typeLabel || community.type}
                                    />
                                    <DetailField label="Teléfono" value={community.phone} />
                                    <DetailField
                                      label="Administrador"
                                      value={community.administratorEmail}
                                    />
                                    <DetailField
                                      label="Dirección"
                                      value={community.address}
                                      span="full"
                                    />
                                    <DetailField
                                      label="Municipio"
                                      value={
                                        communityOverviews[community.id]?.community.municipality
                                      }
                                    />
                                    <DetailField
                                      label="Departamento"
                                      value={communityOverviews[community.id]?.community.department}
                                    />
                                    <DetailField
                                      label="País"
                                      value={communityOverviews[community.id]?.community.country}
                                    />
                                    <DetailField
                                      label="Mensaje de bienvenida"
                                      value={community.welcomeMessage}
                                      span="full"
                                      valueClassName="font-normal"
                                    />
                                  </DetailGrid>
                                  <section className="space-y-1">
                                    <h3 className="text-sm font-semibold">Estructura</h3>
                                    {overviewLoadingId === community.id ? (
                                      <Skeleton className="h-4 w-64" />
                                    ) : (
                                      <div className="flex flex-wrap items-center gap-1">
                                        <p className="text-sm text-muted-foreground">
                                          {formatStructureSummary(
                                            communityOverviews[community.id]?.structureSummary ??
                                              null,
                                          )}
                                        </p>
                                        {!communityOverviews[community.id]?.structureSummary && (
                                          <Button
                                            variant="link"
                                            size="sm"
                                            className="h-auto px-0"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setStructureTarget({
                                                id: community.id,
                                                name: community.name,
                                              });
                                            }}
                                          >
                                            Definir estructura
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </section>
                                  <CommunityLogoField
                                    community={community}
                                    onSelect={(file) => uploadCommunityLogo(community, file)}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                page={communitiesPage.currentPage}
                totalPages={communitiesPage.totalPages}
                onPageChange={setPage}
              />
            </>
          )}

          {section === 'sections' && (
            <>
              <FormDialog
                open={structureFormOpen}
                onOpenChange={setStructureFormOpen}
                title="Definir estructura"
                description="Definí los niveles y los nombres de la jerarquía de la comunidad."
                triggerLabel="Definir estructura"
              >
                <StructureForm
                  communities={communities}
                  onSaved={() => setStructureFormOpen(false)}
                />
              </FormDialog>
              <ListToolbar search={search} onSearchChange={setSearch} placeholder="Buscar sección…">
                <Select value={communityFilter} onValueChange={setCommunityFilter}>
                  <SelectTrigger className="w-48" aria-label="Filtrar por comunidad">
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
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40" aria-label="Filtrar por tipo">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {Object.entries(SECTION_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ListToolbar>
              <div className="overflow-x-auto">
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
                    {sectionsPage.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                          No hay secciones para mostrar
                        </TableCell>
                      </TableRow>
                    )}
                    {sectionsPage.items.map((building) => (
                      <TableRow key={building.id}>
                        <TableCell>{building.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {sectionTypeLabel(building.sectionType, building.sectionTypeLabel)}
                          </Badge>
                        </TableCell>
                        <TableCell>{building.communityName}</TableCell>
                        <TableCell>{building.levelCount}</TableCell>
                        <TableCell>{building.unitCount ?? 0}</TableCell>
                        <TableCell className="font-mono text-xs">{building.code ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{building.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setStructureTarget({
                                id: building.communityId,
                                name: building.communityName,
                              })
                            }
                          >
                            Ver estructura
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                page={sectionsPage.currentPage}
                totalPages={sectionsPage.totalPages}
                onPageChange={setPage}
              />
            </>
          )}

          {section === 'units' && (
            <>
              <ListToolbar search={search} onSearchChange={setSearch} placeholder="Buscar unidad…">
                <Select value={communityFilter} onValueChange={setCommunityFilter}>
                  <SelectTrigger className="w-48" aria-label="Filtrar por comunidad">
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
                  <SelectTrigger className="w-44" aria-label="Filtrar por sección">
                    <SelectValue placeholder="Todas las secciones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las secciones</SelectItem>
                    {sectionOptions.map((building) => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ListToolbar>
              <div className="overflow-x-auto">
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
                    {unitsPage.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No hay unidades para mostrar
                        </TableCell>
                      </TableRow>
                    )}
                    {unitsPage.items.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-mono">{unit.code}</TableCell>
                        <TableCell>{unit.path || unit.sectionName}</TableCell>
                        <TableCell>{unit.communityName}</TableCell>
                        <TableCell>{unit.type}</TableCell>
                        <TableCell>{unit.floor ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{unit.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                page={unitsPage.currentPage}
                totalPages={unitsPage.totalPages}
                onPageChange={setPage}
              />
            </>
          )}

          {section === 'invitations' && (
            <>
              <ListToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="Buscar por email…"
              >
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" aria-label="Filtrar por estado">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="accepted">Aceptada</SelectItem>
                    <SelectItem value="revoked">Revocada</SelectItem>
                    <SelectItem value="expired">Vencida</SelectItem>
                  </SelectContent>
                </Select>
              </ListToolbar>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitationsPage.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No hay invitaciones para mostrar
                        </TableCell>
                      </TableRow>
                    )}
                    {invitationsPage.items.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>{invitation.role}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{invitation.status}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {new Date(invitation.expiresAt).toLocaleDateString('es-AR')}
                        </TableCell>
                        <TableCell>
                          {invitation.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => revokeInvitation(invitation.id)}
                            >
                              Revocar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                page={invitationsPage.currentPage}
                totalPages={invitationsPage.totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

      <Dialog
        open={Boolean(adminInviteCommunity)}
        onOpenChange={(open) => {
          if (!open) setAdminInviteCommunity(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invitar administrador de comunidad</DialogTitle>
            <DialogDescription>
              Asigná un community admin a {adminInviteCommunity?.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={inviteCommunityAdmin} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="community-admin-email">Email</Label>
              <Input
                id="community-admin-email"
                type="email"
                value={adminInviteEmail}
                onChange={(event) => setAdminInviteEmail(event.target.value)}
                required
              />
            </div>
            {adminInviteError && (
              <p role="alert" className="text-sm text-destructive">
                {adminInviteError}
              </p>
            )}
            {adminInviteLink && (
              <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Link de invitación</p>
                <p className="break-all font-mono text-xs">{adminInviteLink}</p>
              </div>
            )}
            <Button type="submit" disabled={adminInviteSaving}>
              {adminInviteSaving ? 'Invitando…' : 'Generar invitación'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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
