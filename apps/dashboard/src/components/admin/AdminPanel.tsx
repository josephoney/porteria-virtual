import { UsersTable } from './UsersTable';
import { CallHistoryTable } from './CallHistoryTable';

export function AdminPanel() {
  return (
    <div className="admin-panel">
      <h2 className="admin-title">Gestión de Usuarios</h2>
      <UsersTable />
      <CallHistoryTable />
    </div>
  );
}
