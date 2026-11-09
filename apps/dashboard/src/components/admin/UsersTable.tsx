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
import { Skeleton } from '../ui/skeleton';

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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const { data } = await get<{ data: UserData[]; total: number }>(
        `/api/users?page=${page}&pageSize=10`,
      );
      setUsers(data.data);
      setTotal(data.total);
    } catch {
      setUsers([]);
      setTotal(0);
      setFetchError('No se pudieron cargar los usuarios. Reintentá en unos segundos.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
    try {
      await patch(`/api/users/${user.id}`, { active: !user.active });
      fetchUsers();
    } catch {
      /* ignore */
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
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
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v })}
                >
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cuenta</TableHead>
            <TableHead>Persona</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Membresías</TableHead>
            <TableHead>Activo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            [...Array(5)].map((_, index) => (
              <TableRow key={`loading-${index}`}>
                <TableCell colSpan={5}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {!loading && fetchError && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center">
                <p className="text-sm text-destructive" role="alert">
                  {fetchError}
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={fetchUsers}>
                  Reintentar
                </Button>
              </TableCell>
            </TableRow>
          )}

          {!loading && !fetchError && users.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                No hay usuarios para mostrar
              </TableCell>
            </TableRow>
          )}

          {!loading && !fetchError && users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{u.personName ?? u.name}</span>
                  {u.personPhone && (
                    <span className="text-[11px] text-muted-foreground">{u.personPhone}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>{u.personDocumentNumber ?? '—'}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {u.isPlatformAdmin && (
                    <Badge variant="secondary" className="w-fit text-[10px]">
                      platform admin
                    </Badge>
                  )}
                  {u.memberships.map((m) => (
                    <div key={m.id} className="flex flex-col gap-1">
                      <Select
                        value={m.role}
                        onValueChange={(v) => handleRoleChange(m.id, v)}
                      >
                        <SelectTrigger
                          className="h-7 w-44 text-xs"
                          aria-label={`Rol de ${u.email}`}
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
                      <span className="text-[11px] text-muted-foreground">
                        {[m.communityName, m.locationUnitName ?? m.locationUnitCode]
                          .filter(Boolean)
                          .join(' · ') || 'Sin comunidad'}
                        {m.status !== 'active' ? ' · inactiva' : ''}
                      </span>
                      {m.role !== 'org_admin' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-fit px-2 text-[11px]"
                          onClick={() =>
                            handleMembershipStatus(m, m.status === 'active' ? 'inactive' : 'active')
                          }
                        >
                          {m.status === 'active' ? 'Quitar asignación' : 'Reactivar'}
                        </Button>
                      )}
                    </div>
                  ))}
                  {!u.isPlatformAdmin && u.memberships.length === 0 && (
                    <span className="text-xs text-muted-foreground">Sin membresías</span>
                  )}
                  {!u.isPlatformAdmin && assignableRoles.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-fit text-xs"
                      onClick={() => openAssignment(u)}
                    >
                      + Asignación
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant={u.active ? 'default' : 'outline'}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u)}>
                    {u.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
                  <SelectValue placeholder="Elegí una comunidad" />
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
            <Button
              type="submit"
              disabled={assignmentSaving || !assignmentForm.communityId}
            >
              {assignmentSaving ? 'Guardando…' : 'Agregar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm font-mono">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
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
