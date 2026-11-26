import { Fragment, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiFileUploadLine,
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
import { Alert, AlertDescription } from '../ui/alert';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { SectionCards } from '../layout/SectionCards';
import { ChartAreaInteractive } from '../layout/ChartAreaInteractive';
import { StructureTreeDialog } from '../layout/StructureTreeDialog';
import { FormDialog } from '../layout/FormDialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { LoadingState } from '../ui/loading-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { UsersTable } from './UsersTable';
import { CallHistoryTable } from './CallHistoryTable';
import { BulkInvitationsDialog } from './BulkInvitationsDialog';
import { InvitationUnitChips } from './InvitationUnitChips';
import { DetailField, DetailGrid } from '../ui/detail-field';
import { LogoUpload } from '../ui/logo-upload';
import { expandableRowProps, useExpandedRow } from '../../lib/use-expanded-row';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../lib/countries';
import { sectionTypeLabel } from '../../lib/section-types';
import { invitationStatusLabel } from '../../lib/invitation-status';
import { queryKeys } from '../../lib/query-keys';
import { emailError, fieldA11y, hasErrors, requiredError } from '../../lib/form';
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
  /** Whether this community issues dynamic QR passes. */
  dynamicQrEnabled: boolean;
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
  units: { id: string; code: string; path: string }[];
}

// Referencias estables para que los `useMemo` no se recalculen mientras la
// query todavía no tiene datos.
const EMPTY_COMMUNITIES: Community[] = [];
const EMPTY_BUILDINGS: Building[] = [];
const EMPTY_UNITS: Unit[] = [];
const EMPTY_INVITATIONS: Invitation[] = [];

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
  dynamicQrEnabled: true,
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
    dynamicQrEnabled: boolean;
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
    dynamicQrEnabled: saved.dynamicQrEnabled ?? payload.dynamicQrEnabled,
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
  sections: {
    title: 'Estructura',
    description: 'Secciones y árbol de ubicaciones de cada comunidad.',
  },
  units: {
    title: 'Unidades',
    description: 'Unidades de cada comunidad, con su sección, tipo y piso.',
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

const sectionLoadingLabel: Record<string, string> = {
  dashboard: 'Cargando panel…',
  communities: 'Cargando comunidades…',
  sections: 'Cargando secciones…',
  invitations: 'Cargando invitaciones…',
  units: 'Cargando unidades…',
};

function AdminSectionLoading({ section }: { section: string }) {
  return <LoadingState label={sectionLoadingLabel[section] ?? 'Cargando…'} />;
}

export function AdminPanel() {
  const location = useLocation();
  const { refresh: refreshWorkspace } = useWorkspace();
  const rawSection = location.pathname.split('/').pop() ?? 'dashboard';
  const section = rawSection === 'admin' ? 'dashboard' : rawSection;
  const meta = sectionMeta[section] ?? sectionMeta.dashboard;

  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  // Cada recurso vive en su propia query: se cachea, se comparte entre
  // pantallas y se pinta en cuanto llega, sin esperar al request más lento.
  const communitiesQuery = useQuery({
    queryKey: queryKeys.tenantCommunities,
    queryFn: async () => (await get<Community[]>('/api/communities')).data,
  });

  const buildingsQuery = useQuery({
    queryKey: queryKeys.buildings,
    queryFn: async () => (await get<{ data: Building[] }>('/api/sections?pageSize=100')).data.data,
  });

  const unitsQuery = useQuery({
    queryKey: queryKeys.units,
    queryFn: async () =>
      (await get<{ data: UnitApi[] }>('/api/units?pageSize=100')).data.data.map((unit) => ({
        ...unit,
        floor: unit.metadata?.legacyFloor ?? null,
        type: unit.metadata?.legacyType ?? 'apartment',
      })),
  });

  const invitationsQuery = useQuery({
    queryKey: queryKeys.invitations,
    queryFn: async () => (await get<Invitation[]>('/api/invitations')).data,
  });

  const userTotalQuery = useQuery({
    queryKey: queryKeys.usersTotal,
    queryFn: async () => (await get<{ total: number }>('/api/users?page=1&pageSize=1')).data.total,
  });

  const communities = communitiesQuery.data ?? EMPTY_COMMUNITIES;
  const buildings = buildingsQuery.data ?? EMPTY_BUILDINGS;
  const units = unitsQuery.data ?? EMPTY_UNITS;
  const invitations = invitationsQuery.data ?? EMPTY_INVITATIONS;
  const userTotal = userTotalQuery.data ?? 0;

  const sectionQueries = [
    communitiesQuery,
    buildingsQuery,
    unitsQuery,
    invitationsQuery,
    userTotalQuery,
  ];
  const refreshing = sectionQueries.some((query) => query.isFetching && !query.isPending);
  // Carga progresiva: cada sección espera sólo el recurso que muestra.
  const initialLoading =
    section === 'invitations'
      ? invitationsQuery.isPending
      : section === 'communities'
        ? communitiesQuery.isPending
        : section === 'units'
          ? unitsQuery.isPending || buildingsQuery.isPending
          : sectionQueries.some((query) => query.isPending);
  const errorMessage =
    error ||
    (sectionQueries.some((query) => query.isError)
      ? 'No se pudo cargar parte de la información. Reintenta en unos segundos.'
      : '');

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
  const [communityFieldErrors, setCommunityFieldErrors] = useState<{
    name?: string;
    address?: string;
    typeLabel?: string;
    latitude?: string;
    longitude?: string;
    passDailyLimit?: string;
  }>({});
  const [adminInviteEmailError, setAdminInviteEmailError] = useState('');
  const [adminInviteCommunity, setAdminInviteCommunity] = useState<Community | null>(null);
  const [adminInviteEmail, setAdminInviteEmail] = useState('');
  const [adminInviteLink, setAdminInviteLink] = useState('');
  const [adminInviteEmailSent, setAdminInviteEmailSent] = useState(false);
  const [adminInviteSentTo, setAdminInviteSentTo] = useState('');
  const [adminInviteCopied, setAdminInviteCopied] = useState(false);
  const [adminInviteSaving, setAdminInviteSaving] = useState(false);
  const [adminInviteError, setAdminInviteError] = useState('');
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<{
    email: string;
    acceptUrl: string;
    emailSent: boolean;
  } | null>(null);
  const [resendCopied, setResendCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const [bulkInvitationsOpen, setBulkInvitationsOpen] = useState(false);
  const [revokePending, setRevokePending] = useState(false);

  /**
   * Revalida los recursos cacheados. A diferencia del `load()` anterior, no
   * desmonta la pantalla: los datos actuales siguen visibles hasta que llega
   * la versión nueva.
   */
  function refreshAll() {
    return queryClient.invalidateQueries();
  }

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

  async function revokeInvitation(invitation: Invitation) {
    setRevokeTarget(invitation);
  }

  async function confirmRevokeInvitation() {
    const invitation = revokeTarget;
    if (!invitation) return;
    setRevokePending(true);
    setError('');
    try {
      await post(`/api/invitations/${invitation.id}/revoke`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations });
      setRevokeTarget(null);
    } catch {
      setError('No se pudo cancelar la invitación.');
    } finally {
      setRevokePending(false);
    }
  }

  async function resendInvitation(invitation: Invitation) {
    setError('');
    setResendingId(invitation.id);
    setResendCopied(false);
    try {
      const response = await post<{ acceptUrl: string; emailSent: boolean }>(
        `/api/invitations/${invitation.id}/resend`,
      );
      setResendResult({
        email: invitation.email,
        acceptUrl: response.data.acceptUrl,
        emailSent: response.data.emailSent,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reenviar la invitación.');
    } finally {
      setResendingId(null);
    }
  }

  async function copyResendLink() {
    if (!resendResult) return;
    try {
      await navigator.clipboard.writeText(resendResult.acceptUrl);
      setResendCopied(true);
    } catch {
      setError('No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.');
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenantCommunities });
      refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el logo.');
    }
  }

  async function inviteCommunityAdmin(event: React.FormEvent) {
    event.preventDefault();
    if (!adminInviteCommunity) return;

    const validation = emailError(adminInviteEmail);
    setAdminInviteEmailError(validation);
    if (validation) return;

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
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitations });
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
      dynamicQrEnabled: community.dynamicQrEnabled ?? true,
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

    const validation = {
      name: requiredError(communityForm.name, 'El nombre'),
      address: requiredError(communityForm.address, 'La dirección'),
      typeLabel:
        communityForm.type === 'otro'
          ? requiredError(communityForm.typeLabel, 'El tipo personalizado')
          : '',
      latitude:
        communityForm.latitude && !Number.isFinite(Number(communityForm.latitude))
          ? 'La latitud debe ser un número.'
          : '',
      longitude:
        communityForm.longitude && !Number.isFinite(Number(communityForm.longitude))
          ? 'La longitud debe ser un número.'
          : '',
      passDailyLimit:
        communityForm.passDailyLimitEnabled &&
        (communityForm.passDailyLimit.trim() === '' ||
          !/^\d+$/.test(communityForm.passDailyLimit) ||
          Number(communityForm.passDailyLimit) < 1)
          ? 'El límite debe ser un entero mayor o igual a 1.'
          : '',
    };
    setCommunityFieldErrors(validation);
    if (hasErrors(validation)) return;

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
      dynamicQrEnabled: communityForm.dynamicQrEnabled,
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
          queryClient.setQueryData<Community[]>(queryKeys.tenantCommunities, (current) =>
            (current ?? []).map((community) =>
              community.id === editedCommunityId ? saved : community,
            ),
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
          queryClient.setQueryData<Community[]>(queryKeys.tenantCommunities, (current) => [
            saved,
            ...(current ?? []).filter((community) => community.id !== saved.id),
          ]);
        }
      }
      setCommunityForm({ ...emptyCommunityForm });
      setEditingCommunityId(null);
      setCommunityFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenantCommunities });
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
      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
        title="Cancelar invitación"
        description={`La invitación de "${revokeTarget?.email ?? ''}" dejará de ser válida y quedará registrada como cancelada; no se elimina del historial.`}
        confirmLabel="Cancelar invitación"
        destructive
        pending={revokePending}
        onConfirm={() => void confirmRevokeInvitation()}
      />
      <BulkInvitationsDialog
        open={bulkInvitationsOpen}
        onOpenChange={setBulkInvitationsOpen}
        communities={communities}
        defaultCommunityId={communities.length === 1 ? communities[0]?.id : undefined}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.invitations });
        }}
      />
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={
          refreshing ? (
            <span role="status" className="text-xs text-muted-foreground">
              Actualizando…
            </span>
          ) : null
        }
      />

      {errorMessage && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <p>{errorMessage}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refreshAll()}>
            Reintentar
          </Button>
        </div>
      )}

      {initialLoading ? (
        <AdminSectionLoading section={section} />
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
                <form onSubmit={saveCommunity} className="space-y-4" noValidate>
                  <div className="space-y-1">
                    <Label htmlFor="admin-community-name">Nombre</Label>
                    <Input
                      id="admin-community-name"
                      value={communityForm.name}
                      onChange={(event) => {
                        setCommunityForm({ ...communityForm, name: event.target.value });
                        setCommunityFieldErrors((prev) => ({ ...prev, name: '' }));
                      }}
                      {...fieldA11y('admin-community-name', communityFieldErrors.name)}
                    />
                    {communityFieldErrors.name && (
                      <p
                        id="admin-community-name-error"
                        role="alert"
                        className="text-xs text-destructive"
                      >
                        {communityFieldErrors.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="admin-community-address">Dirección</Label>
                    <Input
                      id="admin-community-address"
                      value={communityForm.address}
                      onChange={(event) => {
                        setCommunityForm({ ...communityForm, address: event.target.value });
                        setCommunityFieldErrors((prev) => ({ ...prev, address: '' }));
                      }}
                      {...fieldA11y('admin-community-address', communityFieldErrors.address)}
                    />
                    {communityFieldErrors.address && (
                      <p
                        id="admin-community-address-error"
                        role="alert"
                        className="text-xs text-destructive"
                      >
                        {communityFieldErrors.address}
                      </p>
                    )}
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
                      <NativeSelect
                        id="admin-community-country"
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
                      </NativeSelect>
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
                    <NativeSelect
                      id="admin-community-type"
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
                    </NativeSelect>
                  </div>
                  {communityForm.type === 'otro' && (
                    <div className="space-y-1">
                      <Label htmlFor="admin-community-type-label">Tipo personalizado</Label>
                      <Input
                        id="admin-community-type-label"
                        value={communityForm.typeLabel}
                        onChange={(event) => {
                          setCommunityForm({
                            ...communityForm,
                            typeLabel: event.target.value,
                          });
                          setCommunityFieldErrors((prev) => ({ ...prev, typeLabel: '' }));
                        }}
                        {...fieldA11y('admin-community-type-label', communityFieldErrors.typeLabel)}
                      />
                      {communityFieldErrors.typeLabel && (
                        <p
                          id="admin-community-type-label-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {communityFieldErrors.typeLabel}
                        </p>
                      )}
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
                        onChange={(event) => {
                          setCommunityForm({
                            ...communityForm,
                            latitude: event.target.value,
                          });
                          setCommunityFieldErrors((prev) => ({ ...prev, latitude: '' }));
                        }}
                        placeholder="4.711"
                        {...fieldA11y('admin-community-latitude', communityFieldErrors.latitude)}
                      />
                      {communityFieldErrors.latitude && (
                        <p
                          id="admin-community-latitude-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {communityFieldErrors.latitude}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="admin-community-longitude">Longitud</Label>
                      <Input
                        id="admin-community-longitude"
                        type="number"
                        step="0.000001"
                        value={communityForm.longitude}
                        onChange={(event) => {
                          setCommunityForm({
                            ...communityForm,
                            longitude: event.target.value,
                          });
                          setCommunityFieldErrors((prev) => ({ ...prev, longitude: '' }));
                        }}
                        placeholder="-74.0721"
                        {...fieldA11y('admin-community-longitude', communityFieldErrors.longitude)}
                      />
                      {communityFieldErrors.longitude && (
                        <p
                          id="admin-community-longitude-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {communityFieldErrors.longitude}
                        </p>
                      )}
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
                        Cómo se emiten y cuántas autorizaciones puede crear cada unidad por día.
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
                        onChange={(event) => {
                          setCommunityForm({
                            ...communityForm,
                            passDailyLimit: event.target.value,
                          });
                          setCommunityFieldErrors((prev) => ({ ...prev, passDailyLimit: '' }));
                        }}
                        aria-describedby={
                          communityFieldErrors.passDailyLimit
                            ? 'admin-community-limit-error admin-community-limit-help'
                            : 'admin-community-limit-help'
                        }
                        aria-invalid={Boolean(communityFieldErrors.passDailyLimit)}
                      />
                      {communityFieldErrors.passDailyLimit && (
                        <p
                          id="admin-community-limit-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {communityFieldErrors.passDailyLimit}
                        </p>
                      )}
                      <p id="admin-community-limit-help" className="text-xs text-muted-foreground">
                        Entre 1 y 500. Desactiva el límite para no restringir.
                      </p>
                    </div>
                    <div className="space-y-1 border-t border-border pt-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          id="admin-community-dynamic-qr"
                          type="checkbox"
                          checked={communityForm.dynamicQrEnabled}
                          onChange={(event) =>
                            setCommunityForm({
                              ...communityForm,
                              dynamicQrEnabled: event.target.checked,
                            })
                          }
                          className="size-4 accent-foreground"
                        />
                        Pases con QR dinámico
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Con el QR dinámico la persona muestra un código que cambia cada pocos
                        segundos en lugar de un enlace fijo.
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
                                    setAdminInviteEmailError('');
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
                                    <DetailField
                                      label="QR dinámico"
                                      value={
                                        community.dynamicQrEnabled ? 'Habilitado' : 'Deshabilitado'
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
                    <SelectItem value="revoked">Cancelada</SelectItem>
                    <SelectItem value="expired">Vencida</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkInvitationsOpen(true)}
                >
                  <RiFileUploadLine className="size-4" aria-hidden="true" />
                  Carga masiva
                </Button>
              </ListToolbar>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Unidades</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitationsPage.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No hay invitaciones para mostrar
                        </TableCell>
                      </TableRow>
                    )}
                    {invitationsPage.items.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>{invitation.role}</TableCell>
                        <TableCell>
                          <InvitationUnitChips units={invitation.units ?? []} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {invitationStatusLabel(invitation.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {new Date(invitation.expiresAt).toLocaleDateString('es-AR')}
                        </TableCell>
                        <TableCell className="space-x-2">
                          {invitation.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={resendingId === invitation.id}
                                onClick={() => void resendInvitation(invitation)}
                              >
                                {resendingId === invitation.id ? 'Reenviando…' : 'Reenviar'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void revokeInvitation(invitation)}
                              >
                                Cancelar / archivar
                              </Button>
                            </>
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
          <form onSubmit={inviteCommunityAdmin} className="space-y-4" noValidate>
            <div className="space-y-1">
              <Label htmlFor="community-admin-email">Correo</Label>
              <Input
                id="community-admin-email"
                type="email"
                value={adminInviteEmail}
                onChange={(event) => {
                  setAdminInviteEmail(event.target.value);
                  setAdminInviteEmailError('');
                }}
                {...fieldA11y('community-admin-email', adminInviteEmailError)}
              />
              {adminInviteEmailError && (
                <p
                  id="community-admin-email-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {adminInviteEmailError}
                </p>
              )}
            </div>
            {adminInviteError && (
              <Alert variant="destructive">
                <AlertDescription>{adminInviteError}</AlertDescription>
              </Alert>
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

      <Dialog
        open={Boolean(resendResult)}
        onOpenChange={(open) => {
          if (!open) setResendResult(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invitación reenviada</DialogTitle>
            <DialogDescription>
              Se generó un enlace nuevo para {resendResult?.email}. El enlace anterior ya no es
              válido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p role="status" className="text-sm font-medium">
              {resendResult?.emailSent
                ? `Invitación enviada a ${resendResult.email}.`
                : 'No se pudo enviar el correo. Comparte este enlace:'}
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <p className="flex-1 break-all font-mono text-xs">{resendResult?.acceptUrl}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyResendLink()}
              >
                {resendCopied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <Button type="button" variant="outline" onClick={() => setResendResult(null)}>
              Cerrar
            </Button>
          </div>
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
            void queryClient.invalidateQueries({ queryKey: queryKeys.buildings });
            void queryClient.invalidateQueries({ queryKey: queryKeys.units });
            if (communityRow.isExpanded(closedId)) {
              void loadCommunityOverview(closedId);
            }
          }}
        />
      )}
    </div>
  );
}
