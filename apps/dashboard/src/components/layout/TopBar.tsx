import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { RingtoneSelector } from '../operator/RingtoneSelector';
import { Button } from '../ui/button';
import { SidebarTrigger } from '../ui/sidebar';
import { Separator } from '../ui/separator';

export function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <span className="text-sm font-extrabold tracking-widest uppercase truncate">
        PORTERÍA VIRTUAL — PANEL
      </span>
      <div className="flex items-center gap-3 ml-auto">
        <RingtoneSelector />
        <div className="hidden sm:block px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-sm bg-muted border border-border">
          {user?.name}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { logout(); navigate('/login'); }}
        >
          Salir
        </Button>
      </div>
    </header>
  );
}
