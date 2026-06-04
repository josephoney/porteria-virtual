import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function Sidebar() {
  const { user } = useAuth();

  const items = [
    { to: '/', label: 'Operador', roles: ['admin', 'operator'] },
    { to: '/admin', label: 'Admin', roles: ['admin'] },
    { to: '/guard', label: 'Guardia', roles: ['admin', 'guard'] },
  ].filter((item) => user && item.roles.includes(user.role));

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">Navegación</div>
        <span className="badge">{user?.role}</span>
      </div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
