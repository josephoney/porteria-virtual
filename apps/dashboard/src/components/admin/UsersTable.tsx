import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { get, post, patch, ApiError } from '../../lib/apiClient';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { LoadingState } from '../ui/loading-state';
import {
  RiSearchLine,
  RiUserAddLine,
  RiUserFollowLine,
  RiUserUnfollowLine,
} from '@remixicon/react';
import { cn } from '../../lib/utils';

interface MembershipView {
  id: string;
  role: string;
  status: string;
  organizationId: string;
  communityId: string | null;
  communityName?: string | null;
  unitId: string | null;
  locationUnitId: string | null;
  locationUnitName?: string | null;
  locationUnitCode?: string | null;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  personName?: string | null;
  personDocumentNumber?: string | null;
  personPhone?: string | null;
  isPlatformAdmin: boolean;
  active: boolean;
  memberships: MembershipView[];
}

interface CommunityOption {
  id: string;
  name: string;
}

interface UnitOption {
  id: string;
  code: string;
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

const ROLE_LABELS: Record<string, string> = {
  org_admin: 'Admin organización',
  community_admin: 'Admin comunidad',
  operator: 'Operador',
  guard: 'Guardia',
  owner: 'Propietario',
  tenant: 'Inquilino',
  resident: 'Residente',
  staff: 'Staff',
};

export function UsersTable() {
  const { user, activeMembership } = useAuth();
  const assignableRoles = useMemo(() => {
    if (!user) return [];
    if (user.isPlatformAdmin) return ROLES;
    if (activeMembership?.role === 'org_admin') return ROLES.filter((r) => r !== 'org_admin');
    if (activeMembership?.role === 'community_admin') {
      return ROLES.filter((r) => !['org_admin', 'community_admin'].includes(r));
    }
    return [];
  }, [user, activeMembership]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [scopeTotal, setScopeTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [actionError, setActionError] = useState('');
  const [resetTarget, setResetTarget] = useState<UserData | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetMustChange, setResetMustChange] = useState(true);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  /**
   * Mismo alcance que aplica el servidor, para no ofrecer una acción que va a
   * ser rechazada: nadie resetea a un par, a un platform admin ni a otra
   * comunidad.
   */
  function canResetUser(target: UserData): boolean {
    if (target.isPlatformAdmin) return false;
    if (target.id === user?.id) return false;
    if (target.memberships.length === 0) return false;
    if (activeMembership?.role === 'org_admin') {
      return target.memberships.every((membership) => membership.role !== 'org_admin');
    }
    if (activeMembership?.role === 'community_admin') {
      return target.memberships.every(
        (membership) =>
          membership.communityId === activeMembership.communityId &&
          ['operator', 'guard', 'resident'].includes(membership.role),
      );
    }
    return false;
  }

  /** Define una contraseña temporal y decide si obliga a cambiarla al entrar. */
  function openResetDialog(target: UserData) {
    setResetTarget(target);
    setResetPassword(`Zima-${Math.random().toString(36).slice(2, 8)}`);
    setResetMustChange(true);
    setResetResult(null);
    setActionError('');
  }

  async function submitReset(event: React.FormEvent) {
    event.preventDefault();
    if (!resetTarget) return;
    setResetBusy(true);
    try {
      await post(`/api/accounts/${resetTarget.id}/password`, {
        mode: 'direct',
        password: resetPassword,
        mustChange: resetMustChange,
      });
      setResetResult(resetPassword);
    } catch (err) {
      setActionError(
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo cambiar la contraseña de esa cuenta.',
      );
    } finally {
      setResetBusy(false);
    }
  }
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    documentNumber: '',
    phone: '',
    role: 'operator',
    communityId: '',
    unitId: '',
  });
  const [communityIds, setCommunityIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [creating, setCreating] = useState(false);
  const [assignmentUser, setAssignmentUser] = useState<UserData | null>(null);
  const [assignmentUnits, setAssignmentUnits] = useState<UnitOption[]>([]);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    communityId: '',
    role: 'operator',
    locationUnitId: '',
  });

  // Sólo la primera carga muestra el loader: al paginar o filtrar, la tabla
  // se queda con los datos anteriores en lugar de borrarse.
  const initialLoading = loading && !hasLoaded;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError('');

    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const { data } = await get<{
        data: UserData[];
        total: number;
        scopeTotal?: number;
      }>(`/api/users?${params.toString()}`);
      setUsers(data.data);
      setTotal(data.total);
      setScopeTotal(data.scopeTotal ?? data.total);
    } catch {
      setUsers([]);
      setTotal(0);
      setFetchError('No se pudieron cargar los usuarios. Reintenta en unos segundos.');
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    get<CommunityOption[]>('/api/communities')
      .then(({ data }) => setCommunities(data))
      .catch(() => setCommunities([]));
  }, []);

  useEffect(() => {
    if (!form.communityId) {
      setUnits([]);
      return;
    }
    get<UnitOption[]>(`/api/communities/${form.communityId}/units`)
      .then(({ data }) => setUnits(data))
      .catch(() => setUnits([]));
  }, [form.communityId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await post('/api/users', {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        documentNumber: form.documentNumber || undefined,
        phone: form.phone || undefined,
        role: form.role,
        communityId: communityIds[0] || form.communityId || null,
        ...(communityIds.length > 1 ? { communityIds } : {}),
        locationUnitId: communityIds.length > 1 ? null : form.unitId || null,
      });
      setFormOpen(false);
      setCommunityIds([]);
      setForm({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        documentNumber: '',
        phone: '',
        role: 'operator',
        communityId: '',
        unitId: '',
      });
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Error al crear usuario');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(user: UserData) {
    const nextActive = !user.active;
    setActionError('');
    setUsers((prev) =>
      prev.map((item) => (item.id === user.id ? { ...item, active: nextActive } : item)),
    );
    try {
      await patch(`/api/users/${user.id}`, { active: nextActive });
      if (statusFilter !== 'all') fetchUsers();
    } catch (err: unknown) {
      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? { ...item, active: user.active } : item)),
      );
      setActionError(
        err instanceof ApiError ? err.message : 'No se pudo actualizar el estado del usuario',
      );
    }
  }

  async function handleRoleChange(membershipId: string, newRole: string) {
    try {
      await patch(`/api/memberships/${membershipId}`, { role: newRole });
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar el rol');
    }
  }

  async function handleMembershipStatus(membership: MembershipView, status: 'active' | 'inactive') {
    try {
      await patch(`/api/memberships/${membership.id}`, { status });
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Error al actualizar la asignación');
    }
  }

  function openAssignment(user: UserData) {
    setError('');
    setAssignmentUser(user);
    setAssignmentForm({
      communityId: '',
      role: assignableRoles[0] ?? 'operator',
      locationUnitId: '',
    });
    setAssignmentUnits([]);
  }

  useEffect(() => {
    if (!assignmentForm.communityId) {
      setAssignmentUnits([]);
      return;
    }
    get<UnitOption[]>(`/api/communities/${assignmentForm.communityId}/units`)
      .then(({ data }) => setAssignmentUnits(data))
      .catch(() => setAssignmentUnits([]));
  }, [assignmentForm.communityId]);

  async function handleAddAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!assignmentUser || !assignmentForm.communityId) return;
    setError('');
    setAssignmentSaving(true);
    try {
      await post('/api/memberships', {
        userId: assignmentUser.id,
        role: assignmentForm.role,
        communityId: assignmentForm.communityId,
        locationUnitId: assignmentForm.locationUnitId || null,
      });
      setAssignmentUser(null);
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Error al agregar la asignación');
    } finally {
      setAssignmentSaving(false);
    }
  }

  const totalPages = Math.ceil(total / 10);
  const hasFilters = Boolean(debouncedSearch) || statusFilter !== 'all';
  const currentCommunity = activeMembership?.communityId
    ? communities.find((community) => community.id === activeMembership.communityId)
    : null;
  const scopeLabel = user?.isPlatformAdmin
    ? 'en la plataforma'
    : activeMembership?.role === 'community_admin'
      ? `en ${currentCommunity?.name ?? 'la comunidad'}`
      : 'en la organización';
  const userWord = scopeTotal === 1 ? 'usuario' : 'usuarios';
  const countText = hasFilters
    ? `${total} resultado${total === 1 ? '' : 's'} de ${scopeTotal} ${userWord}`
    : `${scopeTotal} ${userWord} ${scopeLabel}`;
  const scopeDescription = hasFilters
    ? `Filtrado de ${scopeTotal} ${userWord} ${scopeLabel}`
    : activeMembership?.role === 'community_admin'
      ? 'Usuarios con membresía en esta comunidad'
      : 'Usuarios registrados en el nivel actual';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold">{countText}</p>
            <p className="text-xs text-muted-foreground">{scopeDescription}</p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button size="sm">+ Nuevo Usuario</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo Usuario</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="flex flex-col gap-3">
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Persona
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="new-first-name">Nombre</Label>
                        <Input
                          id="new-first-name"
                          value={form.firstName}
                          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="new-last-name">Apellido</Label>
                        <Input
                          id="new-last-name"
                          value={form.lastName}
                          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="new-document">Documento</Label>
                        <Input
                          id="new-document"
                          value={form.documentNumber}
                          onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                          placeholder="Opcional"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="new-phone">Teléfono</Label>
                        <Input
                          id="new-phone"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="Opcional"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Cuenta de acceso
                    </p>
                    <div className="space-y-1">
                      <Label htmlFor="new-email">Email</Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-password">Contraseña</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required
                        minLength={8}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-role">Rol</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                      <SelectTrigger id="new-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role] ?? role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-community">Comunidad</Label>
                    <Select
                      value={form.communityId || 'none'}
                      onValueChange={(v) =>
                        setForm({ ...form, communityId: v === 'none' ? '' : v, unitId: '' })
                      }
                    >
                      <SelectTrigger id="new-community">
                        <SelectValue placeholder="Sin comunidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin comunidad</SelectItem>
                        {communities.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.role !== 'org_admin' && (
                    <div className="space-y-1">
                      <Label>Comunidades asignadas</Label>
                      <div className="grid max-h-32 gap-1 overflow-y-auto rounded border border-border p-2">
                        {communities.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={communityIds.includes(c.id)}
                              onChange={(event) =>
                                setCommunityIds((current) =>
                                  event.target.checked
                                    ? [...current, c.id]
                                    : current.filter((id) => id !== c.id),
                                )
                              }
                            />
                            {c.name}
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Para staff/community admin se puede asignar más de una comunidad.
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="new-unit">Unidad</Label>
                    <Select
                      value={form.unitId || 'none'}
                      onValueChange={(v) => setForm({ ...form, unitId: v === 'none' ? '' : v })}
                      disabled={!form.communityId || communityIds.length > 1}
                    >
                      <SelectTrigger id="new-unit">
                        <SelectValue placeholder="Sin unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin unidad</SelectItem>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" className="mt-2" disabled={creating}>
                    {creating ? 'Creando…' : 'Crear'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por correo, nombre o documento"
              className="pl-9"
              aria-label="Buscar usuarios por correo, nombre o documento"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as 'all' | 'active' | 'inactive');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar usuarios por estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setPage(1);
            }}
            disabled={!search && statusFilter === 'all'}
          >
            Limpiar
          </Button>
        </div>

        {actionError && (
          <Alert variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}
      </div>

      {initialLoading ? (
        <LoadingState label="Cargando usuarios…" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>Persona</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Comunidad</TableHead>
              <TableHead>Membresía</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fetchError && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <p className="text-sm text-destructive" role="alert">
                    {fetchError}
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={fetchUsers}>
                    Reintentar
                  </Button>
                </TableCell>
              </TableRow>
            )}

            {!fetchError && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No hay usuarios para mostrar
                </TableCell>
              </TableRow>
            )}

            {!fetchError &&
              users.map((u) => {
                const memberships: (MembershipView | null)[] =
                  u.memberships.length > 0 ? u.memberships : [null];

                return memberships.map((m, index) => {
                  const rowSpan = memberships.length;
                  const canManageMembership = Boolean(m && assignableRoles.includes(m.role));

                  return (
                    <TableRow key={`${u.id}-${m?.id ?? 'none'}`} className="h-10">
                      {index === 0 && (
                        <>
                          <TableCell rowSpan={rowSpan} className="py-2 align-top font-medium">
                            <div className="flex items-center gap-1">
                              <span>{u.email}</span>
                              {canResetUser(u) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  aria-label={`Cambiar contraseña de ${u.email}`}
                                  onClick={() => openResetDialog(u)}
                                >
                                  Contraseña
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell rowSpan={rowSpan} className="py-2 align-top">
                            <div className="flex flex-col">
                              <span>{u.personName ?? u.name}</span>
                              {u.personPhone && (
                                <span className="text-[11px] text-muted-foreground">
                                  {u.personPhone}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell rowSpan={rowSpan} className="py-2 align-top">
                            {u.personDocumentNumber ?? '—'}
                          </TableCell>
                        </>
                      )}

                      <TableCell className="py-2 align-top">{m?.communityName ?? '—'}</TableCell>

                      <TableCell className="py-2 align-top">
                        {u.isPlatformAdmin ? (
                          <Badge variant="secondary" className="text-[10px]">
                            platform admin
                          </Badge>
                        ) : m ? (
                          <div className="flex items-center gap-1.5">
                            {canManageMembership ? (
                              <Select
                                value={m.role}
                                onValueChange={(value) => handleRoleChange(m.id, value)}
                              >
                                <SelectTrigger
                                  className="h-8 w-36 text-xs"
                                  aria-label={`Rol de ${u.email} en ${m.communityName ?? 'la comunidad'}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {assignableRoles.map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {ROLE_LABELS[role] ?? role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline">{ROLE_LABELS[m.role] ?? m.role}</Badge>
                            )}
                            {m.status !== 'active' && (
                              <Badge variant="outline" className="text-[10px]">
                                Inactiva
                              </Badge>
                            )}
                            {canManageMembership && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                title={
                                  m.status === 'active'
                                    ? 'Quitar asignación'
                                    : 'Reactivar asignación'
                                }
                                aria-label={
                                  m.status === 'active'
                                    ? `Quitar asignación de ${u.email} en ${m.communityName ?? 'la comunidad'}`
                                    : `Reactivar asignación de ${u.email} en ${m.communityName ?? 'la comunidad'}`
                                }
                                onClick={() =>
                                  handleMembershipStatus(
                                    m,
                                    m.status === 'active' ? 'inactive' : 'active',
                                  )
                                }
                              >
                                {m.status === 'active' ? (
                                  <RiUserUnfollowLine />
                                ) : (
                                  <RiUserFollowLine />
                                )}
                              </Button>
                            )}
                            {index === 0 && !u.isPlatformAdmin && assignableRoles.length > 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-xs"
                                title="Agregar asignación"
                                aria-label={`Agregar asignación a ${u.email}`}
                                onClick={() => openAssignment(u)}
                              >
                                <RiUserAddLine />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Sin membresías</span>
                            {!u.isPlatformAdmin && assignableRoles.length > 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-xs"
                                title="Agregar asignación"
                                aria-label={`Agregar asignación a ${u.email}`}
                                onClick={() => openAssignment(u)}
                              >
                                <RiUserAddLine />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>

                      {index === 0 && (
                        <TableCell rowSpan={rowSpan} className="py-2 align-top">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={u.active}
                            aria-label={`${u.active ? 'Desactivar' : 'Activar'} usuario ${u.email}`}
                            onClick={() => handleToggleActive(u)}
                            className={cn(
                              'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium transition-colors',
                              u.active
                                ? 'bg-success text-success-foreground'
                                : 'bg-destructive text-destructive-foreground',
                            )}
                          >
                            {u.active ? 'Activo' : 'Inactivo'}
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                });
              })}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={Boolean(assignmentUser)}
        onOpenChange={(open) => {
          if (!open) setAssignmentUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar asignación</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddAssignment} className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Usuario: <span className="font-medium text-foreground">{assignmentUser?.email}</span>
            </p>
            <div className="space-y-1">
              <Label htmlFor="assignment-community">Comunidad</Label>
              <Select
                value={assignmentForm.communityId || 'none'}
                onValueChange={(value) =>
                  setAssignmentForm({
                    ...assignmentForm,
                    communityId: value === 'none' ? '' : value,
                    locationUnitId: '',
                  })
                }
              >
                <SelectTrigger id="assignment-community">
                  <SelectValue placeholder="Elige una comunidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin comunidad</SelectItem>
                  {communities.map((community) => (
                    <SelectItem key={community.id} value={community.id}>
                      {community.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="assignment-role">Rol</Label>
              <Select
                value={assignmentForm.role}
                onValueChange={(value) => setAssignmentForm({ ...assignmentForm, role: value })}
              >
                <SelectTrigger id="assignment-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role] ?? role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="assignment-unit">Unidad (opcional)</Label>
              <Select
                value={assignmentForm.locationUnitId || 'none'}
                onValueChange={(value) =>
                  setAssignmentForm({
                    ...assignmentForm,
                    locationUnitId: value === 'none' ? '' : value,
                  })
                }
                disabled={!assignmentForm.communityId}
              >
                <SelectTrigger id="assignment-unit">
                  <SelectValue placeholder="Sin unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin unidad</SelectItem>
                  {assignmentUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={assignmentSaving || !assignmentForm.communityId}>
              {assignmentSaving ? 'Guardando…' : 'Agregar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setResetResult(null);
            setResetPassword('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
          {resetResult ? (
            <div className="space-y-3">
              <p className="text-sm">
                Contraseña temporal de <span className="font-medium">{resetTarget?.email}</span>. Se
                muestra una sola vez y sus sesiones quedaron revocadas.
              </p>
              <code className="block rounded-xl bg-muted px-3 py-2 font-mono text-sm">
                {resetResult}
              </code>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(resetResult)}
                >
                  Copiar
                </Button>
                <Button type="button" size="sm" onClick={() => setResetTarget(null)}>
                  Listo
                </Button>
              </div>
              {resetMustChange && (
                <p className="text-xs text-muted-foreground">
                  Deberá cambiarla en el próximo ingreso: el resto de la plataforma queda bloqueado
                  hasta entonces.
                </p>
              )}
            </div>
          ) : (
            <form className="space-y-3" onSubmit={submitReset}>
              <div className="space-y-1">
                <Label htmlFor="reset-temp-password">Contraseña temporal</Label>
                <Input
                  id="reset-temp-password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Al menos ocho caracteres. Entrégasela a la persona por un canal directo.
                </p>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={resetMustChange}
                  onChange={(event) => setResetMustChange(event.target.checked)}
                />
                <span>
                  Obligar a cambiar la contraseña en el próximo ingreso
                  <span className="block text-xs text-muted-foreground">
                    Si lo desactivas, la persona podrá seguir usando la temporal.
                  </span>
                </span>
              </label>
              {actionError && <p className="text-sm text-destructive">{actionError}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetTarget(null)}
                  disabled={resetBusy}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={resetBusy || resetPassword.length < 8}>
                  {resetBusy ? 'Guardando…' : 'Definir contraseña'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm font-mono">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            ‹
          </Button>
          <span className="text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            ›
          </Button>
        </div>
      )}
    </div>
  );
}
