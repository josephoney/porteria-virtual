import { useEffect, useState } from 'react';
import { cn } from 'cn';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';

const SHOW_MS = 5000;
const EXIT_MS = 200;
const SESSION_KEY = 'porteria_welcome_toast';

type Phase = 'hidden' | 'visible' | 'leaving';

function sessionKey(userId: string, workspaceKind: string, workspaceId: string | null) {
  return `${SESSION_KEY}:${userId}:${workspaceKind}:${workspaceId ?? 'none'}`;
}

export function WorkspaceWelcomeToast() {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const [phase, setPhase] = useState<Phase>('hidden');

  useEffect(() => {
    if (!user || workspace.isLoading || !workspace.name) return;

    const key = sessionKey(user.id, workspace.kind, workspace.id);
    try {
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Storage may be unavailable; show the toast anyway.
    }

    setPhase('visible');
  }, [user, workspace.isLoading, workspace.name, workspace.kind, workspace.id]);

  useEffect(() => {
    if (phase !== 'visible') return;
    const timer = window.setTimeout(() => setPhase('leaving'), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const timer = window.setTimeout(() => setPhase('hidden'), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'hidden') return null;

  const displayName = user?.name?.trim() || user?.email || '';
  const contextName = workspace.kind === 'platform' ? 'Plataforma' : workspace.name;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed left-1/2 top-6 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card px-6 py-4 text-center shadow-lg',
        phase === 'visible'
          ? 'animate-in fade-in slide-in-from-top-4 duration-300'
          : 'animate-out fade-out slide-out-to-top-4 duration-200',
      )}
    >
      <p className="font-heading text-base font-bold tracking-tight">
        {displayName ? `Bienvenido, ${displayName}` : 'Bienvenido'}
      </p>
      {contextName && <p className="mt-1 text-sm text-muted-foreground">{contextName}</p>}
    </div>
  );
}
