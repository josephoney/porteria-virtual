import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="topbar">
      <div className="topbar-brand">PORTERÍA VIRTUAL — PANEL</div>
      <div className="topbar-right">
        <div className="op-badge">{user?.name}</div>
        <button
          className="topbar-logout"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          Salir
        </button>
      </div>
    </div>
  );
}
