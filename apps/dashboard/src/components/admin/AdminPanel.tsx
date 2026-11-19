import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiNodeTree,
  RiPencilLine,
  RiUserAddLine,
} from '@remixicon/react';
import { assetObjectUrl, get, patch, post, upload } from '../../lib/apiClient';
import { PageHeader } from '../layout/PageHeader';
import { ListToolbar } from '../layout/ListToolbar';
import { Pagination } from '../layout/Pagination';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { SectionCards } from '../layout/SectionCards';
import { ChartAreaInteractive } from '../layout/ChartAreaInteractive';
import { StructureTreeDialog } from '../layout/StructureTreeDialog';
import { FormDialog } from '../layout/FormDialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { UsersTable } from './UsersTable';
import { CallHistoryTable } from './CallHistoryTable';
import { UnitsWorkspace } from './UnitsWorkspace';
import { DetailField, DetailGrid } from '../ui/detail-field';
import { LogoUpload } from '../ui/logo-upload';
import { expandableRowProps, useExpandedRow } from '../../lib/use-expanded-row';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../lib/countries';
import { sectionTypeLabel } from '../../lib/section-types';
import { useWorkspace } from '../../contexts/WorkspaceContext';

interface Community {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  type: string | null;
  typeLabel: string | null;
  welcomeMessage: string | null;
  passDailyLimitEnabled: boolean;
  passDailyLimit: number;
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
  code: string | null;
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
  /** The daily rule the administration sets for this community. */
  passDailyLimitEnabled: true,
  passDailyLimit: '50',
  timezone: 'America/Bogota',
  slug: '',
};

function mergeCommunity(
  payload: {
    name: string;
    address: string;
    phone: string | null;
    type: string;
    typeLabel: string | null;
    welcomeMessage: string | null;
    passDailyLimitEnabled: boolean;
    passDailyLimit: number;
  },
  saved: Partial<Community> & { id?: string },
): Community | null {
  if (!saved.id) return null;
  return {
    id: saved.id,
    name: payload.name,
    address: payload.address,
    phone: saved.phone ?? payload.phone ?? null,
    type: saved.type ?? payload.type,
    typeLabel: saved.typeLabel ?? (payload.typeLabel || null),
    welcomeMessage: saved.welcomeMessage ?? (payload.welcomeMessage || null),
    passDailyLimitEnabled: saved.passDailyLimitEnabled ?? payload.passDailyLimitEnabled,
    passDailyLimit: saved.passDailyLimit ?? payload.passDailyLimit,
    logoAssetId: saved.logoAssetId ?? null,
    administratorEmail: saved.administratorEmail ?? null,
    status: saved.status ?? 'active',
  };
}

const sectionMeta: Record<string, { title: string; description: string }> = {
  dashboard: {
    title: 'Resumen',
    description: 'Vista general de tu organización o comunidad.',
  },
  communities: {
    title: 'Comunidades',
    description: 'Comunidades dentro de tu alcance.',
  },
  units: {
    title: 'Unidades',
    description: 'Estructura, secciones y unidades de cada comunidad.',
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
  const [structureTarget, setStructureTarget] = useState<{ id: string; name: string } | null>(null);
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
  const [adminInviteEmailSent, setAdminInviteEmailSent] = useState(false);
  const [adminInviteSentTo, setAdminInviteSentTo] = useState('');
  const [adminInviteCopied, setAdminInviteCopied] = useState(false);
  const [adminInviteSaving, setAdminInviteSaving] = useState(false);
  const [adminInviteError, setAdminInviteError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    // Independent resources: one failed request must not blank the whole panel.
    const [communityResult, sectionResult, unitResult, invitationResult, userResult] =
      await Promise.allSettled([
        get<Community[]>('/api/communities'),
        get<{ data: Building[] }>('/api/sections?pageSize=100'),
        get<{ data: UnitApi[] }>('/api/units?pageSize=100'),
        get<Invitation[]>('/api/invitations'),
        get<{ total: number }>('/api/users?page=1&pageSize=1'),
      ]);

    if (communityResult.status === 'fulfilled') {
      setCommunities(communityResult.value.data);
    }

    if (sectionResult.status === 'fulfilled') {
      setBuildings(sectionResult.value.data.data);
    }

    if (unitResult.status === 'fulfilled') {
      setUnits(
        unitResult.value.data.data.map((unit) => ({
          ...unit,
          floor: unit.metadata?.legacyFloor ?? null,
          type: unit.metadata?.legacyType ?? 'apartment',
        })),
      );
    }

    if (invitationResult.status === 'fulfilled') {
      setInvitations(invitationResult.value.data);
    }

    if (userResult.status === 'fulfilled') {
      setUserTotal(userResult.value.data.total);
    }

    if (
      [communityResult, sectionResult, unitResult, invitationResult, userResult].some(
        (result) => result.status === 'rejected',
      )
    ) {
      setError('No se pudo cargar parte de la información. Reintenta en unos segundos.');
    }

    setLoading(false);
  }, [refreshKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadCommunityOverview(communityId: string) {
    setOverviewLoadingId(communityId);
    try {
      const result = await get<CommunityOverview>(`/api/communities/${communityId}/overview`);
      setCommunityOverviews((current) => ({
        ...current,
        [communityId]: result.data,
      }));
    } catch {
      setError('No se pudo cargar el detalle de la comunidad.');
    } finally {
      setOverviewLoadingId(null);
    }
  }

  async function toggleCommunity(community: Community) {
    if (communityRow.isExpanded(community.id)) {
      communityRow.collapse();
      return;
    }
    communityRow.toggle(community.id);
    if (communityOverviews[community.id]) return;

    await loadCommunityOverview(community.id);
  }

  useEffect(() => {
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  }, [section]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const filteredCommunities = useMemo(
    () =>
      communities.filter((community) =>
        `${community.name} ${community.address}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [communities, search],
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
    const email = adminInviteEmail;
    setAdminInviteSaving(true);
    setAdminInviteError('');
    setAdminInviteLink('');
    setAdminInviteEmailSent(false);
    setAdminInviteSentTo('');
    setAdminInviteCopied(false);
    try {
      const response = await post<{ acceptUrl: string; emailSent: boolean }>('/api/invitations', {
        email,
        role: 'community_admin',
        communityId: adminInviteCommunity.id,
      });
      setAdminInviteLink(response.data.acceptUrl);
      setAdminInviteEmailSent(response.data.emailSent);
      setAdminInviteSentTo(email);
      setAdminInviteEmail('');
      await load();
    } catch (err) {
      setAdminInviteError(err instanceof Error ? err.message : 'No se pudo crear la invitación.');
    } finally {
      setAdminInviteSaving(false);
    }
  }

  async function copyAdminInviteLink() {
    if (!adminInviteLink) return;
    try {
      await navigator.clipboard.writeText(adminInviteLink);
      setAdminInviteCopied(true);
    } catch {
      setAdminInviteError('No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.');
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
      passDailyLimitEnabled: community.passDailyLimitEnabled ?? true,
      passDailyLimit: String(community.passDailyLimit ?? 50),
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
    const editedCommunityId = editingCommunityId;
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
      passDailyLimitEnabled: communityForm.passDailyLimitEnabled,
      passDailyLimit: Number(communityForm.passDailyLimit) || 50,
      ...(communityForm.timezone ? { timezone: communityForm.timezone } : {}),
      ...(communityForm.slug ? { slug: communityForm.slug } : {}),
    };
    try {
      if (editedCommunityId) {
        const result = await patch<Partial<Community> & { id: string }>(
          `/api/communities/${editedCommunityId}`,
          payload,
        );
        const saved = mergeCommunity(payload, { ...result.data, id: editedCommunityId });
        if (saved) {
          setCommunities((current) =>
            current.map((community) => (community.id === editedCommunityId ? saved : community)),
          );
        }
      } else {
        const result = await post<Partial<Community> & { id: string }>(
          '/api/organizations/me/communities',
          payload,
        );
        const saved = mergeCommunity(payload, result.data);
        if (saved) {
          // The row must show up immediately, not after the background reload.
          setCommunities((current) => [
            saved,
            ...current.filter((community) => community.id !== saved.id),
          ]);
        }
      }
      setCommunityForm({ ...emptyCommunityForm });
      setEditingCommunityId(null);
      setCommunityFormOpen(false);
      await load();
      refreshWorkspace();

      // The expanded detail reads from a cached overview; drop it so the row
      // does not keep showing the values from before the edit.
      if (editedCommunityId) {
        setCommunityOverviews((current) => {
          const next = { ...current };
          delete next[editedCommunityId];
          return next;
        });
        if (communityRow.isExpanded(editedCommunityId)) {
          setOverviewLoadingId(editedCommunityId);
          try {
            const result = await get<CommunityOverview>(
              `/api/communities/${editedCommunityId}/overview`,
            );
            setCommunityOverviews((current) => ({ ...current, [editedCommunityId]: result.data }));
          } finally {
            setOverviewLoadingId(null);
          }
        }
      }
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
                    label: 'Agrupadores',
                    value: buildings.length,
                    description: 'Primer nivel de las estructuras',
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
                    ? 'Actualiza los datos de la comunidad.'
                    : 'Crea una comunidad dentro de tu organización.'
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
                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Reglas</p>
                      <p className="text-xs text-muted-foreground">
                        Cuántas autorizaciones puede crear cada unidad por día.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        id="admin-community-limit-enabled"
                        type="checkbox"
                        checked={communityForm.passDailyLimitEnabled}
                        onChange={(event) =>
                          setCommunityForm({
                            ...communityForm,
                            passDailyLimitEnabled: event.target.checked,
                          })
                        }
                        className="size-4 accent-foreground"
                      />
                      Limitar autorizaciones por día
                    </label>
                    <div className="space-y-1">
                      <Label htmlFor="admin-community-limit">Máximo por unidad y día</Label>
                      <Input
                        id="admin-community-limit"
                        type="number"
                        min={1}
                        max={500}
                        value={communityForm.passDailyLimit}
                        disabled={!communityForm.passDailyLimitEnabled}
                        onChange={(event) =>
                          setCommunityForm({
                            ...communityForm,
                            passDailyLimit: event.target.value,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Entre 1 y 500. Desactiva el límite para no restringir.
                      </p>
                    </div>
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
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  title="Editar comunidad"
                                  aria-label={`Editar ${community.name}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void openCommunityEdit(community);
                                  }}
                                >
                                  <RiPencilLine />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  title="Ver estructura"
                                  aria-label={`Ver estructura de ${community.name}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setStructureTarget({
                                      id: community.id,
                                      name: community.name,
                                    });
                                  }}
                                >
                                  <RiNodeTree />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  title="Invitar administrador"
                                  aria-label={`Invitar administrador a ${community.name}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setAdminInviteCommunity(community);
                                    setAdminInviteEmail('');
                                    setAdminInviteLink('');
                                    setAdminInviteEmailSent(false);
                                    setAdminInviteSentTo('');
                                    setAdminInviteCopied(false);
                                    setAdminInviteError('');
                                  }}
                                >
                                  <RiUserAddLine />
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
                                    <DetailField
                                      label="Límite diario"
                                      value={
                                        community.passDailyLimitEnabled
                                          ? `${community.passDailyLimit} por unidad`
                                          : 'Sin límite'
                                      }
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
                                    {buildings.filter(
                                      (building) => building.communityId === community.id,
                                    ).length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {buildings
                                          .filter(
                                            (building) => building.communityId === community.id,
                                          )
                                          .map((building) => (
                                            <Badge key={building.id} variant="secondary">
                                              {building.name} ·{' '}
                                              {sectionTypeLabel(
                                                building.sectionType,
                                                building.sectionTypeLabel,
                                              )}
                                            </Badge>
                                          ))}
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

          {section === 'units' && (
            <UnitsWorkspace
              communities={communities.map((community) => ({
                id: community.id,
                name: community.name,
              }))}
              onStructureChanged={() => setRefreshKey((value) => value + 1)}
            />
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
              Asigna un community admin a {adminInviteCommunity?.name}.
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
              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                <p role="status" className="text-sm font-medium">
                  {adminInviteEmailSent
                    ? `Invitación enviada a ${adminInviteSentTo}.`
                    : 'No se pudo enviar el correo. Comparte este enlace:'}
                </p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 break-all font-mono text-xs">{adminInviteLink}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyAdminInviteLink()}
                  >
                    {adminInviteCopied ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
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
            if (open) return;
            const closedId = structureTarget.id;
            setStructureTarget(null);
            setCommunityOverviews((current) => {
              const next = { ...current };
              delete next[closedId];
              return next;
            });
            // Structure changes must reach the table that opened the dialog.
            setRefreshKey((value) => value + 1);
            if (communityRow.isExpanded(closedId)) {
              void loadCommunityOverview(closedId);
            }
          }}
        />
      )}
    </div>
  );
}
