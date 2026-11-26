import { Fragment, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post, patch } from '../lib/apiClient';
import { emailError, fieldA11y, hasErrors, requiredError } from '../lib/form';
import { RiFileUploadLine } from '@remixicon/react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { NativeSelect } from '../components/ui/native-select';
import { Tabs, TabsContent } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { PageHeader } from '../components/layout/PageHeader';
import { SectionCards } from '../components/layout/SectionCards';
import { FormDialog } from '../components/layout/FormDialog';
import { COUNTRIES, DEFAULT_COUNTRY } from '../lib/countries';
import { ListToolbar } from '../components/layout/ListToolbar';
import { StructureTreeDialog } from '../components/layout/StructureTreeDialog';
import { Skeleton } from '../components/ui/skeleton';
import { LoadingState } from '../components/ui/loading-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { DetailField, DetailGrid } from '../components/ui/detail-field';
import { expandableRowProps, useExpandedRow } from '../lib/use-expanded-row';
import { invitationStatusLabel } from '../lib/invitation-status';
import { queryKeys } from '../lib/query-keys';
import { BulkInvitationsDialog } from '../components/admin/BulkInvitationsDialog';
import { InvitationUnitChips } from '../components/admin/InvitationUnitChips';

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
    municipality: string | null;
    department: string | null;
    country: string | null;
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
  code: string | null;
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
  units: { id: string; code: string; path: string }[];
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

const EMPTY_ORGANIZATIONS: Organization[] = [];
const EMPTY_COMMUNITIES: Community[] = [];
const EMPTY_BUILDINGS: Building[] = [];
const EMPTY_UNITS: Unit[] = [];
const EMPTY_INVITATIONS: Invitation[] = [];
const EMPTY_PLATFORM_USERS: PlatformUser[] = [];

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

const sectionLoadingLabel: Record<string, string> = {
  dashboard: 'Cargando panel…',
  organizations: 'Cargando organizaciones…',
  communities: 'Cargando comunidades…',
  sections: 'Cargando secciones…',
  invitations: 'Cargando invitaciones…',
  users: 'Cargando usuarios…',
  units: 'Cargando unidades…',
};

function PlatformSectionLoading({ section }: { section: string }) {
  return <LoadingState label={sectionLoadingLabel[section] ?? 'Cargando…'} />;
}

export function PlatformPage() {
  const location = useLocation();
  const rawSection = location.pathname.split('/').pop() ?? 'organizations';
  const section = rawSection === 'platform' ? 'dashboard' : rawSection;
  const meta = PAGE_META[section] ?? PAGE_META.dashboard;
  const queryClient = useQueryClient();

  // Cada recurso en su propia query: cache compartida con el panel de admin,
  // deduplicación de requests y pintado en cuanto llega cada uno.
  const organizationsQuery = useQuery({
    queryKey: queryKeys.platformOrganizations,
    queryFn: async () =>
      (await get<{ data: Organization[] }>('/api/platform/organizations?pageSize=100')).data.data,
  });

  const communitiesQuery = useQuery({
    queryKey: queryKeys.platformCommunities,
    queryFn: async () =>
      (await get<{ data: Community[] }>('/api/platform/communities?pageSize=100')).data.data,
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

  const platformUsersQuery = useQuery({
    queryKey: queryKeys.platformUsers,
    queryFn: async () =>
      (await get<{ data: PlatformUser[]; total: number }>('/api/platform/users?pageSize=100')).data
        .data,
  });

  const organizations = organizationsQuery.data ?? EMPTY_ORGANIZATIONS;
  const communities = communitiesQuery.data ?? EMPTY_COMMUNITIES;
  const buildings = buildingsQuery.data ?? EMPTY_BUILDINGS;
  const units = unitsQuery.data ?? EMPTY_UNITS;
  const invitations = invitationsQuery.data ?? EMPTY_INVITATIONS;
  const platformUsers = platformUsersQuery.data ?? EMPTY_PLATFORM_USERS;

  const sectionQueries = [
    organizationsQuery,
    communitiesQuery,
    buildingsQuery,
    unitsQuery,
    invitationsQuery,
    platformUsersQuery,
  ];
  const refreshing = sectionQueries.some((query) => query.isFetching && !query.isPending);
  // Carga progresiva: cada pestaña espera sólo el recurso que muestra.
  const initialLoading =
    section === 'organizations'
      ? organizationsQuery.isPending
      : section === 'communities'
        ? communitiesQuery.isPending
        : section === 'invitations'
          ? invitationsQuery.isPending
          : section === 'users'
            ? platformUsersQuery.isPending
            : section === 'units'
              ? unitsQuery.isPending || buildingsQuery.isPending
              : sectionQueries.some((query) => query.isPending);

  const [inviteLink, setInviteLink] = useState('');
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [inviteSentTo, setInviteSentTo] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [error, setError] = useState('');
  const errorMessage =
    error ||
    (sectionQueries.some((query) => query.isError)
      ? 'No se pudo cargar parte de la información. Reintenta en unos segundos.'
      : '');
  const [formDialog, setFormDialog] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const [bulkInvitationsOpen, setBulkInvitationsOpen] = useState(false);
  const [revokePending, setRevokePending] = useState(false);
  const [organizationSearch, setOrganizationSearch] = useState('');
  const organizationRow = useExpandedRow();
  const [editingOrganizationId, setEditingOrganizationId] = useState<string | null>(null);
  const [organizationOverview, setOrganizationOverview] = useState<OrganizationOverview | null>(
    null,
  );
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [communitySearch, setCommunitySearch] = useState('');
  const [communityOrganizationFilter, setCommunityOrganizationFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [structureTarget, setStructureTarget] = useState<{ id: string; name: string } | null>(null);

  const [orgForm, setOrgForm] = useState({
    name: '',
    slug: '',
    municipality: '',
    department: '',
    country: DEFAULT_COUNTRY,
  });
  const [orgAdministrator, setOrgAdministrator] = useState<
    { status: 'active'; email: string; name: string } | { status: 'pending'; email: string } | null
  >(null);
  const [orgAdministratorLoading, setOrgAdministratorLoading] = useState(false);
  const [orgAdminEmail, setOrgAdminEmail] = useState('');
  const [orgInviteUrl, setOrgInviteUrl] = useState('');
  const [orgInviteEmailSent, setOrgInviteEmailSent] = useState(false);
  const [orgInviteCopied, setOrgInviteCopied] = useState(false);
  const [communityInviteTarget, setCommunityInviteTarget] = useState<Community | null>(null);
  const [communityInviteEmail, setCommunityInviteEmail] = useState('');
  const [communityInviteSaving, setCommunityInviteSaving] = useState(false);
  const [communityInviteError, setCommunityInviteError] = useState('');
  const [communityInviteResult, setCommunityInviteResult] = useState<{
    email: string;
    acceptUrl: string;
    emailSent: boolean;
  } | null>(null);
  const [communityInviteCopied, setCommunityInviteCopied] = useState(false);
  const [communityForm, setCommunityForm] = useState({
    organizationId: '',
    name: '',
    address: '',
    timezone: 'America/Bogota',
    slug: '',
  });
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'resident',
    organizationId: '',
    communityId: '',
    unitId: '',
  });
  const [orgFieldErrors, setOrgFieldErrors] = useState<{ name?: string; adminEmail?: string }>({});
  const [communityFieldErrors, setCommunityFieldErrors] = useState<{
    organizationId?: string;
    name?: string;
    address?: string;
    timezone?: string;
  }>({});
  const [inviteFieldErrors, setInviteFieldErrors] = useState<{
    email?: string;
    organizationId?: string;
  }>({});
  const [communityInviteEmailError, setCommunityInviteEmailError] = useState('');

  const invalidate = (...keys: readonly (readonly unknown[])[]) =>
    Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

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

  async function toggleOrganizationOverview(id: string) {
    if (organizationRow.isExpanded(id)) {
      organizationRow.collapse();
      setOrganizationOverview(null);
      return;
    }
    organizationRow.toggle(id);
    setOrganizationOverview(null);
    setOverviewLoading(true);
    try {
      const result = await get<OrganizationOverview>(`/api/platform/organizations/${id}/overview`);
      setOrganizationOverview(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la organización.');
    } finally {
      setOverviewLoading(false);
    }
  }

  async function refreshOrganizationOverview(id: string) {
    try {
      const result = await get<OrganizationOverview>(`/api/platform/organizations/${id}/overview`);
      setOrganizationOverview(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la organización.');
    }
  }

  function openOrganizationCreate() {
    setEditingOrganizationId(null);
    setOrgForm({
      name: '',
      slug: '',
      municipality: '',
      department: '',
      country: DEFAULT_COUNTRY,
    });
    setOrgAdministrator(null);
    setOrgAdminEmail('');
    setOrgInviteUrl('');
    setOrgInviteEmailSent(false);
    setOrgInviteCopied(false);
    setOrgFieldErrors({});
    setFormDialog('organizations');
  }

  async function openOrganizationEdit(organization: Organization) {
    setEditingOrganizationId(organization.id);
    setOrgForm({
      name: organization.name,
      slug: organization.slug,
      municipality: '',
      department: '',
      country: '',
    });
    setOrgAdministrator(null);
    setOrgAdminEmail('');
    setOrgInviteUrl('');
    setOrgInviteEmailSent(false);
    setOrgInviteCopied(false);
    setOrgFieldErrors({});
    setFormDialog('organizations');
    setOrgAdministratorLoading(true);
    try {
      const result = await get<OrganizationOverview>(
        `/api/platform/organizations/${organization.id}/overview`,
      );
      const overview = result.data;
      setOrgForm({
        name: overview.organization.name,
        slug: overview.organization.slug,
        municipality: overview.organization.municipality ?? '',
        department: overview.organization.department ?? '',
        country: overview.organization.country ?? '',
      });
      if (overview.administrator) {
        setOrgAdministrator({
          status: 'active',
          email: overview.administrator.email,
          name: overview.administrator.name,
        });
      } else if (overview.pendingAdministrator) {
        setOrgAdministrator({
          status: 'pending',
          email: overview.pendingAdministrator.email,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la organización.');
    } finally {
      setOrgAdministratorLoading(false);
    }
  }

  async function saveOrganization(e: React.FormEvent) {
    e.preventDefault();

    const validation = {
      name: requiredError(orgForm.name, 'El nombre'),
      adminEmail:
        editingOrganizationId && orgAdminEmail.trim() !== ''
          ? emailError(orgAdminEmail, 'El correo del administrador')
          : '',
    };
    setOrgFieldErrors(validation);
    if (hasErrors(validation)) return;

    setError('');
    try {
      if (editingOrganizationId) {
        const result = await patch<{
          administrator:
            | { status: 'active'; email: string; name: string }
            | { status: 'pending'; email: string; acceptUrl: string; emailSent: boolean }
            | null;
        }>(`/api/platform/organizations/${editingOrganizationId}`, {
          name: orgForm.name,
          ...(orgAdminEmail.trim() ? { administratorEmail: orgAdminEmail.trim() } : {}),
        });
        const administrator = result.data.administrator;
        if (administrator?.status === 'pending') {
          setOrgInviteUrl(administrator.acceptUrl);
          setOrgInviteEmailSent(administrator.emailSent);
          setOrgInviteCopied(false);
          setOrgAdministrator({ status: 'pending', email: administrator.email });
        } else if (administrator?.status === 'active') {
          setOrgInviteUrl('');
          setOrgInviteEmailSent(false);
          setOrgInviteCopied(false);
          setOrgAdministrator({
            status: 'active',
            email: administrator.email,
            name: administrator.name,
          });
        }
        setOrgAdminEmail('');
        if (organizationRow.isExpanded(editingOrganizationId)) {
          await refreshOrganizationOverview(editingOrganizationId);
        }
      } else {
        await post('/api/platform/organizations', {
          name: orgForm.name,
          ...(orgForm.slug ? { slug: orgForm.slug } : {}),
          municipality: orgForm.municipality || null,
          department: orgForm.department || null,
          country: orgForm.country || null,
        });
        setOrgForm({
          name: '',
          slug: '',
          municipality: '',
          department: '',
          country: DEFAULT_COUNTRY,
        });
      }
      await invalidate(queryKeys.platformOrganizations);
      if (!editingOrganizationId) setFormDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando organización');
    }
  }

  async function createCommunity(e: React.FormEvent) {
    e.preventDefault();

    const validation = {
      organizationId: requiredError(communityForm.organizationId, 'La organización'),
      name: requiredError(communityForm.name, 'El nombre'),
      address: requiredError(communityForm.address, 'La dirección'),
      timezone: requiredError(communityForm.timezone, 'La zona horaria'),
    };
    setCommunityFieldErrors(validation);
    if (hasErrors(validation)) return;

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
      await invalidate(queryKeys.platformCommunities);
      setFormDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando comunidad');
    }
  }

  async function createInvitation(e: React.FormEvent) {
    e.preventDefault();

    const validation = {
      email: emailError(inviteForm.email),
      organizationId: requiredError(inviteForm.organizationId, 'La organización'),
    };
    setInviteFieldErrors(validation);
    if (hasErrors(validation)) return;

    setError('');
    setInviteLink('');
    setInviteEmailSent(false);
    setInviteSentTo('');
    setInviteCopied(false);
    const email = inviteForm.email;
    try {
      const { data } = await post<{ acceptUrl: string; emailSent: boolean }>('/api/invitations', {
        email,
        role: inviteForm.role,
        organizationId: inviteForm.organizationId || undefined,
        communityId: inviteForm.communityId || null,
        locationUnitId: inviteForm.unitId || null,
      });
      setInviteLink(data.acceptUrl);
      setInviteEmailSent(data.emailSent);
      setInviteSentTo(email);
      setInviteForm({
        email: '',
        role: 'resident',
        organizationId: inviteForm.organizationId,
        communityId: inviteForm.communityId,
        unitId: inviteForm.unitId,
      });
      await invalidate(queryKeys.invitations);
      setFormDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando invitación');
    }
  }

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
      await invalidate(queryKeys.invitations);
      setRevokeTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar la invitación.');
    } finally {
      setRevokePending(false);
    }
  }

  async function resendInvitation(invitation: Invitation) {
    try {
      const { data } = await post<{ acceptUrl: string; emailSent: boolean }>(
        `/api/invitations/${invitation.id}/resend`,
      );
      setInviteLink(data.acceptUrl);
      setInviteEmailSent(data.emailSent);
      setInviteSentTo(invitation.email);
      setInviteCopied(false);
      await invalidate(queryKeys.invitations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error reenviando invitación');
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
    } catch {
      setError('No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.');
    }
  }

  async function copyOrgInviteLink() {
    if (!orgInviteUrl) return;
    try {
      await navigator.clipboard.writeText(orgInviteUrl);
      setOrgInviteCopied(true);
    } catch {
      setError('No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.');
    }
  }

  function openCommunityInvite(community: Community) {
    setCommunityInviteTarget(community);
    setCommunityInviteEmail('');
    setCommunityInviteSaving(false);
    setCommunityInviteError('');
    setCommunityInviteEmailError('');
    setCommunityInviteResult(null);
    setCommunityInviteCopied(false);
  }

  async function inviteCommunityAdmin(event: React.FormEvent) {
    event.preventDefault();
    if (!communityInviteTarget) return;

    const validation = emailError(communityInviteEmail);
    setCommunityInviteEmailError(validation);
    if (validation) return;

    const email = communityInviteEmail;
    setCommunityInviteSaving(true);
    setCommunityInviteError('');
    setCommunityInviteResult(null);
    setCommunityInviteCopied(false);
    try {
      const { data } = await post<{ acceptUrl: string; emailSent: boolean }>(
        `/api/platform/communities/${communityInviteTarget.id}/invitations`,
        { email },
      );
      setCommunityInviteResult({
        email,
        acceptUrl: data.acceptUrl,
        emailSent: data.emailSent,
      });
      setCommunityInviteEmail('');
      await invalidate(queryKeys.invitations);
    } catch (err) {
      setCommunityInviteError(
        err instanceof Error ? err.message : 'No se pudo crear la invitación.',
      );
    } finally {
      setCommunityInviteSaving(false);
    }
  }

  async function copyCommunityInviteLink() {
    if (!communityInviteResult) return;
    try {
      await navigator.clipboard.writeText(communityInviteResult.acceptUrl);
      setCommunityInviteCopied(true);
    } catch {
      setCommunityInviteError('No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.');
    }
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
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

      {initialLoading ? (
        <PlatformSectionLoading section={section} />
      ) : (
        <>
          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                <p>{errorMessage}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => void queryClient.invalidateQueries()}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={section}>
            <TabsContent value="dashboard" className="space-y-4">
              <SectionCards
                items={[
                  {
                    label: 'Organizaciones',
                    value: organizations.length,
                    description: 'Clientes activos',
                  },
                  {
                    label: 'Comunidades',
                    value: communities.length,
                    description: 'En todas las organizaciones',
                  },
                  {
                    label: 'Agrupadores',
                    value: buildings.length,
                    description: 'Agrupadores de ubicación',
                  },
                  { label: 'Unidades', value: units.length, description: 'Espacios administrados' },
                  {
                    label: 'Invitaciones',
                    value: invitations.length,
                    description: 'Enviadas y pendientes',
                  },
                  {
                    label: 'Usuarios',
                    value: platformUsers.length,
                    description: 'Membresías globales',
                  },
                ]}
              />
            </TabsContent>

            <TabsContent value="organizations" className="space-y-4">
              <FormDialog
                open={formDialog === 'organizations'}
                onOpenChange={(open) => {
                  setFormDialog(open ? 'organizations' : null);
                  if (!open) setEditingOrganizationId(null);
                }}
                title={editingOrganizationId ? 'Editar organización' : 'Nueva organización'}
                description={
                  editingOrganizationId
                    ? 'Actualiza el nombre y el administrador de la organización.'
                    : 'Crea una organización para agrupar comunidades.'
                }
                hideTrigger
              >
                <form onSubmit={saveOrganization} className="space-y-4" noValidate>
                  <div className="space-y-1">
                    <Label htmlFor="platform-organization-name">Nombre</Label>
                    <Input
                      id="platform-organization-name"
                      value={orgForm.name}
                      onChange={(e) => {
                        setOrgForm({ ...orgForm, name: e.target.value });
                        setOrgFieldErrors((prev) => ({ ...prev, name: '' }));
                      }}
                      {...fieldA11y('platform-organization-name', orgFieldErrors.name)}
                    />
                    {orgFieldErrors.name && (
                      <p
                        id="platform-organization-name-error"
                        role="alert"
                        className="text-xs text-destructive"
                      >
                        {orgFieldErrors.name}
                      </p>
                    )}
                  </div>
                  {editingOrganizationId ? (
                    <>
                      <div className="space-y-1">
                        <Label>Slug</Label>
                        <p className="font-mono text-sm text-muted-foreground">{orgForm.slug}</p>
                      </div>
                      <div className="space-y-1">
                        <Label>Administrador actual</Label>
                        {orgAdministratorLoading ? (
                          <Skeleton className="h-9 w-full" />
                        ) : orgAdministrator ? (
                          <p className="text-sm">
                            {orgAdministrator.email}
                            {orgAdministrator.status === 'pending' && (
                              <span className="ml-2 text-muted-foreground">
                                (Administrador pendiente)
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Sin administrador</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="platform-organization-admin">Nuevo administrador</Label>
                        <Input
                          id="platform-organization-admin"
                          type="email"
                          placeholder="correo@ejemplo.com"
                          value={orgAdminEmail}
                          onChange={(event) => {
                            setOrgAdminEmail(event.target.value);
                            setOrgFieldErrors((prev) => ({ ...prev, adminEmail: '' }));
                          }}
                          aria-describedby={
                            orgFieldErrors.adminEmail
                              ? 'platform-organization-admin-error platform-organization-admin-help'
                              : 'platform-organization-admin-help'
                          }
                          aria-invalid={Boolean(orgFieldErrors.adminEmail)}
                        />
                        {orgFieldErrors.adminEmail && (
                          <p
                            id="platform-organization-admin-error"
                            role="alert"
                            className="text-xs text-destructive"
                          >
                            {orgFieldErrors.adminEmail}
                          </p>
                        )}
                        <p
                          id="platform-organization-admin-help"
                          className="text-xs text-muted-foreground"
                        >
                          Si el correo ya tiene cuenta, el cambio es inmediato. Si no, se envía una
                          invitación y el administrador actual sigue activo hasta que se acepte.
                        </p>
                      </div>
                      {orgInviteUrl && (
                        <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                          <p role="status" className="text-sm font-medium">
                            {orgInviteEmailSent
                              ? `Invitación enviada a ${orgAdministrator?.email ?? ''}.`
                              : 'No se pudo enviar el correo. Comparte este enlace:'}
                          </p>
                          <p className="break-all font-mono text-xs">{orgInviteUrl}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void copyOrgInviteLink()}
                          >
                            {orgInviteCopied ? 'Copiado' : 'Copiar enlace'}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="platform-organization-slug">Slug (opcional)</Label>
                        <Input
                          id="platform-organization-slug"
                          value={orgForm.slug}
                          onChange={(e) => setOrgForm({ ...orgForm, slug: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="platform-organization-municipality">Municipio</Label>
                          <Input
                            id="platform-organization-municipality"
                            value={orgForm.municipality}
                            onChange={(e) =>
                              setOrgForm({ ...orgForm, municipality: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="platform-organization-department">Departamento</Label>
                          <Input
                            id="platform-organization-department"
                            value={orgForm.department}
                            onChange={(e) => setOrgForm({ ...orgForm, department: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="platform-organization-country">País</Label>
                          <NativeSelect
                            id="platform-organization-country"
                            value={orgForm.country}
                            onChange={(e) => setOrgForm({ ...orgForm, country: e.target.value })}
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
                    </>
                  )}
                  <div className="flex justify-end">
                    <Button type="submit">
                      {editingOrganizationId ? 'Guardar cambios' : 'Crear organización'}
                    </Button>
                  </div>
                </form>
              </FormDialog>
              <ListToolbar
                search={organizationSearch}
                onSearchChange={setOrganizationSearch}
                placeholder="Buscar organización…"
                actions={<Button onClick={openOrganizationCreate}>Crear organización</Button>}
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
                  {filteredOrganizations.map((o) => {
                    const isExpanded = organizationRow.isExpanded(o.id);
                    return (
                      <Fragment key={o.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/40"
                          {...expandableRowProps(o.id, isExpanded, toggleOrganizationOverview)}
                        >
                          <TableCell className="font-medium">{o.name}</TableCell>
                          <TableCell className="font-mono text-xs">{o.slug}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                openOrganizationEdit(o);
                              }}
                            >
                              Editar
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={3} className="bg-muted/30">
                              {overviewLoading ? (
                                <Skeleton className="h-24 w-full" />
                              ) : organizationOverview ? (
                                <div className="space-y-6 py-2">
                                  <DetailGrid>
                                    <DetailField
                                      label="Nombre"
                                      value={organizationOverview.organization.name}
                                      valueClassName="text-base font-bold"
                                    />
                                    <DetailField
                                      label="Slug"
                                      value={organizationOverview.organization.slug}
                                      valueClassName="font-mono text-sm font-normal"
                                    />
                                    <DetailField
                                      label="NIT"
                                      value={organizationOverview.organization.nit}
                                    />
                                    <DetailField
                                      label="Teléfono"
                                      value={organizationOverview.organization.phone}
                                    />
                                    <DetailField
                                      label="Dirección"
                                      value={organizationOverview.organization.address}
                                      span="full"
                                    />
                                    <DetailField
                                      label="Municipio"
                                      value={organizationOverview.organization.municipality}
                                    />
                                    <DetailField
                                      label="Departamento"
                                      value={organizationOverview.organization.department}
                                    />
                                    <DetailField
                                      label="País"
                                      value={organizationOverview.organization.country}
                                    />
                                    <DetailField
                                      label="Mensaje de bienvenida"
                                      value={organizationOverview.organization.welcomeMessage}
                                      span="full"
                                      valueClassName="font-normal"
                                    />
                                  </DetailGrid>

                                  <section className="space-y-3">
                                    <h3 className="text-sm font-semibold">Representante legal</h3>
                                    {organizationOverview.legalRepresentative ? (
                                      <DetailGrid>
                                        <DetailField
                                          label="Nombre"
                                          value={`${organizationOverview.legalRepresentative.firstName} ${organizationOverview.legalRepresentative.lastName}`.trim()}
                                        />
                                        <DetailField
                                          label="Documento"
                                          value={[
                                            organizationOverview.legalRepresentative.documentType,
                                            organizationOverview.legalRepresentative.documentNumber,
                                          ]
                                            .filter(Boolean)
                                            .join(' ')}
                                        />
                                        <DetailField
                                          label="Teléfono"
                                          value={organizationOverview.legalRepresentative.phone}
                                        />
                                        <DetailField
                                          label="Correo"
                                          value={
                                            organizationOverview.legalRepresentative.contactEmail
                                          }
                                        />
                                      </DetailGrid>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">Sin completar</p>
                                    )}
                                  </section>

                                  <section className="space-y-3">
                                    <h3 className="text-sm font-semibold">Administrador</h3>
                                    {organizationOverview.administrator ? (
                                      <DetailGrid>
                                        <DetailField
                                          label="Nombre"
                                          value={organizationOverview.administrator.name}
                                        />
                                        <DetailField
                                          label="Correo"
                                          value={organizationOverview.administrator.email}
                                        />
                                        <DetailField
                                          label="Estado"
                                          value={organizationOverview.administrator.status}
                                        />
                                      </DetailGrid>
                                    ) : organizationOverview.pendingAdministrator ? (
                                      <DetailGrid>
                                        <DetailField
                                          label="Correo invitado"
                                          value={organizationOverview.pendingAdministrator.email}
                                        />
                                        <DetailField label="Estado" value="Invitación pendiente" />
                                      </DetailGrid>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">
                                        Sin administrador
                                      </p>
                                    )}
                                  </section>

                                  <section className="space-y-3">
                                    <h3 className="text-sm font-semibold">
                                      Comunidades ({organizationOverview.communities.length})
                                    </h3>
                                    {organizationOverview.communities.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">
                                        Sin comunidades.
                                      </p>
                                    ) : (
                                      <ul className="space-y-1">
                                        {organizationOverview.communities.map((community) => (
                                          <li
                                            key={community.id}
                                            className="flex flex-wrap items-baseline gap-x-2 text-sm"
                                          >
                                            <span className="font-medium">{community.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {community.sectionCount} secciones ·{' '}
                                              {community.unitCount} unidades
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </section>
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
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="communities" className="space-y-4">
              <FormDialog
                open={formDialog === 'communities'}
                onOpenChange={(open) => {
                  setFormDialog(open ? 'communities' : null);
                  if (!open) setCommunityFieldErrors({});
                }}
                title="Nueva comunidad"
                description="Asocia una comunidad a una organización existente."
                triggerLabel="Crear comunidad"
                hidden
              >
                <form onSubmit={createCommunity} className="space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="platform-community-organization">Organización</Label>
                      <NativeSelect
                        id="platform-community-organization"
                        value={communityForm.organizationId}
                        onChange={(e) => {
                          setCommunityForm({ ...communityForm, organizationId: e.target.value });
                          setCommunityFieldErrors((prev) => ({ ...prev, organizationId: '' }));
                        }}
                        {...fieldA11y(
                          'platform-community-organization',
                          communityFieldErrors.organizationId,
                        )}
                      >
                        <option value="">Elegir…</option>
                        {organizations.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </NativeSelect>
                      {communityFieldErrors.organizationId && (
                        <p
                          id="platform-community-organization-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {communityFieldErrors.organizationId}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="platform-community-name">Nombre</Label>
                      <Input
                        id="platform-community-name"
                        value={communityForm.name}
                        onChange={(e) => {
                          setCommunityForm({ ...communityForm, name: e.target.value });
                          setCommunityFieldErrors((prev) => ({ ...prev, name: '' }));
                        }}
                        {...fieldA11y('platform-community-name', communityFieldErrors.name)}
                      />
                      {communityFieldErrors.name && (
                        <p
                          id="platform-community-name-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {communityFieldErrors.name}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="platform-community-address">Dirección</Label>
                      <Input
                        id="platform-community-address"
                        value={communityForm.address}
                        onChange={(e) => {
                          setCommunityForm({ ...communityForm, address: e.target.value });
                          setCommunityFieldErrors((prev) => ({ ...prev, address: '' }));
                        }}
                        {...fieldA11y('platform-community-address', communityFieldErrors.address)}
                      />
                      {communityFieldErrors.address && (
                        <p
                          id="platform-community-address-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {communityFieldErrors.address}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="platform-community-timezone">Zona horaria</Label>
                      <Input
                        id="platform-community-timezone"
                        value={communityForm.timezone}
                        onChange={(e) => {
                          setCommunityForm({ ...communityForm, timezone: e.target.value });
                          setCommunityFieldErrors((prev) => ({ ...prev, timezone: '' }));
                        }}
                        {...fieldA11y('platform-community-timezone', communityFieldErrors.timezone)}
                      />
                      {communityFieldErrors.timezone && (
                        <p
                          id="platform-community-timezone-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {communityFieldErrors.timezone}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="platform-community-slug">Slug (opcional)</Label>
                      <Input
                        id="platform-community-slug"
                        value={communityForm.slug}
                        onChange={(e) =>
                          setCommunityForm({ ...communityForm, slug: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">Crear comunidad</Button>
                  </div>
                </form>
              </FormDialog>
              <ListToolbar
                search={communitySearch}
                onSearchChange={setCommunitySearch}
                placeholder="Buscar comunidad…"
              >
                <NativeSelect
                  className="h-9 w-auto"
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
                </NativeSelect>
              </ListToolbar>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Organización</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommunities.length === 0 && (
                    <EmptyRow colSpan={5}>No hay comunidades para mostrar</EmptyRow>
                  )}
                  {filteredCommunities.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                      <TableCell>{c.organizationName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openCommunityInvite(c)}>
                          Invitar administrador
                        </Button>
                      </TableCell>
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
                        {[
                          ...new Set(u.memberships.map((m) => m.organizationName).filter(Boolean)),
                        ].join(', ') || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {u.memberships
                          .map((m) =>
                            [m.communityName, m.locationUnitName ?? m.locationUnitCode]
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                <FormDialog
                  open={formDialog === 'invitations'}
                  onOpenChange={(open) => {
                    setFormDialog(open ? 'invitations' : null);
                    if (!open) setInviteFieldErrors({});
                  }}
                  title="Nueva invitación"
                  description="Invita a una persona a la plataforma."
                  triggerLabel="Invitar"
                >
                <form onSubmit={createInvitation} className="space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="platform-invite-email">Correo</Label>
                      <Input
                        id="platform-invite-email"
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => {
                          setInviteForm({ ...inviteForm, email: e.target.value });
                          setInviteFieldErrors((prev) => ({ ...prev, email: '' }));
                        }}
                        {...fieldA11y('platform-invite-email', inviteFieldErrors.email)}
                      />
                      {inviteFieldErrors.email && (
                        <p
                          id="platform-invite-email-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {inviteFieldErrors.email}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="platform-invite-role">Rol</Label>
                      <NativeSelect
                        id="platform-invite-role"
                        value={inviteForm.role}
                        onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="platform-invite-organization">Organización</Label>
                      <NativeSelect
                        id="platform-invite-organization"
                        value={inviteForm.organizationId}
                        onChange={(e) => {
                          setInviteForm({
                            ...inviteForm,
                            organizationId: e.target.value,
                            communityId: '',
                            unitId: '',
                          });
                          setInviteFieldErrors((prev) => ({ ...prev, organizationId: '' }));
                        }}
                        {...fieldA11y(
                          'platform-invite-organization',
                          inviteFieldErrors.organizationId,
                        )}
                      >
                        <option value="">Elegir…</option>
                        {organizations.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </NativeSelect>
                      {inviteFieldErrors.organizationId && (
                        <p
                          id="platform-invite-organization-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {inviteFieldErrors.organizationId}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="platform-invite-community">Comunidad</Label>
                      <NativeSelect
                        id="platform-invite-community"
                        value={inviteForm.communityId}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            communityId: e.target.value,
                            unitId: '',
                          })
                        }
                      >
                        <option value="">Sin comunidad</option>
                        {communities
                          .filter((c) => c.organizationId === inviteForm.organizationId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </NativeSelect>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="platform-invite-unit">Unidad</Label>
                      <NativeSelect
                        id="platform-invite-unit"
                        value={inviteForm.unitId}
                        onChange={(e) => setInviteForm({ ...inviteForm, unitId: e.target.value })}
                      >
                        <option value="">Sin unidad</option>
                        {units
                          .filter((u) => u.communityId === inviteForm.communityId)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.path || u.sectionName} · {u.code}
                            </option>
                          ))}
                      </NativeSelect>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">Invitar</Button>
                  </div>
                </form>
              </FormDialog>
                <Button variant="outline" onClick={() => setBulkInvitationsOpen(true)}>
                  <RiFileUploadLine className="size-4" aria-hidden="true" />
                  Carga masiva
                </Button>
              </div>

              {inviteLink && (
                <div className="space-y-2 rounded border border-border bg-muted/40 p-2">
                  <p role="status" className="px-1 text-sm font-medium">
                    {inviteEmailSent
                      ? `Invitación enviada a ${inviteSentTo}.`
                      : 'No se pudo enviar el correo. Comparte este enlace:'}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all text-xs">{inviteLink}</code>
                    <Button size="sm" variant="outline" onClick={() => void copyInviteLink()}>
                      {inviteCopied ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Unidades</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.length === 0 && (
                    <EmptyRow colSpan={6}>No hay invitaciones para mostrar</EmptyRow>
                  )}
                  {invitations.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.email}</TableCell>
                      <TableCell>{i.role}</TableCell>
                      <TableCell>
                        <InvitationUnitChips units={i.units ?? []} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{invitationStatusLabel(i.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(i.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="space-x-2">
                        {i.status === 'pending' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => resendInvitation(i)}>
                              Reenviar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void revokeInvitation(i)}
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
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog
        open={Boolean(communityInviteTarget)}
        onOpenChange={(open) => {
          if (!open) setCommunityInviteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invitar administrador de comunidad</DialogTitle>
            <DialogDescription>
              Asigna un administrador a {communityInviteTarget?.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={inviteCommunityAdmin} className="space-y-4" noValidate>
            <div className="space-y-1">
              <Label htmlFor="platform-community-admin-email">Correo</Label>
              <Input
                id="platform-community-admin-email"
                type="email"
                value={communityInviteEmail}
                onChange={(event) => {
                  setCommunityInviteEmail(event.target.value);
                  setCommunityInviteEmailError('');
                }}
                {...fieldA11y('platform-community-admin-email', communityInviteEmailError)}
              />
              {communityInviteEmailError && (
                <p
                  id="platform-community-admin-email-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {communityInviteEmailError}
                </p>
              )}
            </div>
            {communityInviteError && (
              <Alert variant="destructive">
                <AlertDescription>{communityInviteError}</AlertDescription>
              </Alert>
            )}
            {communityInviteResult && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                <p role="status" className="text-sm font-medium">
                  {communityInviteResult.emailSent
                    ? `Invitación enviada a ${communityInviteResult.email}.`
                    : 'No se pudo enviar el correo. Comparte este enlace:'}
                </p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 break-all font-mono text-xs">
                    {communityInviteResult.acceptUrl}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyCommunityInviteLink()}
                  >
                    {communityInviteCopied ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
              </div>
            )}
            <Button type="submit" disabled={communityInviteSaving}>
              {communityInviteSaving ? 'Invitando…' : 'Generar invitación'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <BulkInvitationsDialog
        open={bulkInvitationsOpen}
        onOpenChange={setBulkInvitationsOpen}
        communities={communities}
        onCreated={() => {
          void invalidate(queryKeys.invitations);
        }}
      />

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
