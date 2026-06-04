import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CONFIG } from '../../config';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  locationId: string | null;
  active: boolean;
}

const roleBadges: Record<string, string> = {
  admin: 'badge-dark',
  operator: 'badge-blue',
  guard: 'badge-amber',
  resident: 'badge-green',
};

export function UsersTable() {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'operator' });
  const [error, setError] = useState('');

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${CONFIG.API_URL}/api/users?page=${page}&pageSize=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setUsers(data.data);
    setTotal(data.total);
  }, [token, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch(`${CONFIG.API_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.message || 'Error al crear usuario');
      return;
    }
    setShowForm(false);
    setForm({ email: '', name: '', password: '', role: 'operator' });
    fetchUsers();
  }

  async function handleToggleActive(user: UserData) {
    await fetch(`${CONFIG.API_URL}/api/users/${user.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ active: !user.active }),
    });
    fetchUsers();
  }

  async function handleRoleChange(user: UserData, newRole: string) {
    await fetch(`${CONFIG.API_URL}/api/users/${user.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role: newRole }),
    });
    fetchUsers();
  }

  const totalPages = Math.ceil(total / 10);

  return (
    <div className="users-section">
      <div className="users-header">
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nuevo Usuario'}
        </button>
      </div>

      {showForm && (
        <form className="user-form" onSubmit={handleCreate}>
          <input
            className="form-input"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className="form-input"
            type="text"
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="form-input"
            type="password"
            placeholder="Contraseña (mín 8 caracteres)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <select
            className="form-input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="admin">Admin</option>
            <option value="operator">Operador</option>
            <option value="guard">Guardia</option>
            <option value="resident">Residente</option>
          </select>
          <button className="btn-primary" type="submit">Crear</button>
          {error && <div className="form-error">{error}</div>}
        </form>
      )}

      <table className="users-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Nombre</th>
            <th>Rol</th>
            <th>Activo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.name}</td>
              <td>
                <select
                  className="role-select"
                  value={u.role}
                  onChange={(e) => handleRoleChange(u, e.target.value)}
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operador</option>
                  <option value="guard">Guardia</option>
                  <option value="resident">Residente</option>
                </select>
              </td>
              <td>
                <button
                  className={`toggle-btn ${u.active ? 'active' : 'inactive'}`}
                  onClick={() => handleToggleActive(u)}
                >
                  {u.active ? 'Activo' : 'Inactivo'}
                </button>
              </td>
              <td>
                <span className={`role-badge ${roleBadges[u.role] || ''}`}>{u.role}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            ←
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            →
          </button>
        </div>
      )}
    </div>
  );
}
