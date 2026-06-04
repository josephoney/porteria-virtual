import { UsersTable } from './UsersTable';

export function AdminPanel() {
  return (
    <div className="admin-panel">
      <h2 className="admin-title">Gestión de Usuarios</h2>
      <UsersTable />
    </div>
  );
}
