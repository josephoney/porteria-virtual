import { useState, useEffect, useCallback } from 'react';
import { get, post, patch, ApiError } from '../../lib/apiClient';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  locationId: string | null;
  active: boolean;
}

export function UsersTable() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'operator' });
  const [error, setError] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await get<{ data: UserData[]; total: number }>(
        `/api/users?page=${page}&pageSize=10`,
      );
      setUsers(data.data);
      setTotal(data.total);
    } catch {
      setUsers([]);
      setTotal(0);
    }
  }, [page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await post('/api/users', form);
      setFormOpen(false);
      setForm({ email: '', name: '', password: '', role: 'operator' });
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Error al crear usuario');
    }
  }

  async function handleToggleActive(user: UserData) {
    try {
      await patch(`/api/users/${user.id}`, { active: !user.active });
      fetchUsers();
    } catch { /* ignore */ }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await patch(`/api/users/${userId}`, { role: newRole });
      fetchUsers();
    } catch { /* ignore */ }
  }

  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-lg font-extrabold tracking-wide">Usuarios</h3>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button size="sm">+ Nuevo Usuario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="space-y-1">
                <Label htmlFor="new-email">Email</Label>
                <Input id="new-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-name">Nombre</Label>
                <Input id="new-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-password">Contraseña</Label>
                <Input id="new-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              </div>
              <div className="space-y-1">
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operator">Operador</SelectItem>
                    <SelectItem value="guard">Guardia</SelectItem>
                    <SelectItem value="resident">Residente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <Button type="submit" className="mt-2">Crear</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Activo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.email}</TableCell>
              <TableCell>{u.name}</TableCell>
              <TableCell>
                <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operator">Operador</SelectItem>
                    <SelectItem value="guard">Guardia</SelectItem>
                    <SelectItem value="resident">Residente</SelectItem>
                  </SelectContent>
                </Select>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm font-mono">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>←</Button>
          <span className="text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>→</Button>
        </div>
      )}
    </div>
  );
}
