import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { assetObjectUrl, get } from '../lib/apiClient';
import { useAuth } from './AuthContext';

export type WorkspaceKind = 'platform' | 'organization' | 'community';

export interface WorkspaceState {
  kind: WorkspaceKind;
  id: string | null;
  name: string;
  logoAssetId: string | null;
  logoUrl: string | null;
  isLoading: boolean;
  refresh: () => void;
}

const PLATFORM_NAME = 'Portería Virtual';

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function useWorkspace(): WorkspaceState {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace debe usarse dentro de un WorkspaceProvider');
  }
  return context;
}

interface WorkspaceTarget {
  kind: WorkspaceKind;
  id: string | null;
}

function resolveTarget(
  isPlatformAdmin: boolean,
  membership: {
    id: string;
    role: string;
    organizationId: string;
    communityId: string | null;
  } | null,
): WorkspaceTarget {
  if (!membership) return { kind: 'platform', id: null };
  if (isPlatformAdmin && membership.id === 'platform') {
    return { kind: 'platform', id: null };
  }
  if (membership.communityId) {
    return { kind: 'community', id: membership.communityId };
  }
  if (membership.role === 'org_admin') {
    return { kind: 'organization', id: membership.organizationId };
  }
  return { kind: 'platform', id: null };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, activeMembership } = useAuth();
  const [version, setVersion] = useState(0);
  const [workspace, setWorkspace] = useState<Omit<WorkspaceState, 'refresh'>>({
    kind: 'platform',
    id: null,
    name: PLATFORM_NAME,
    logoAssetId: null,
    logoUrl: null,
    isLoading: false,
  });

  const target = useMemo(
    () => resolveTarget(Boolean(user?.isPlatformAdmin), activeMembership),
    [user?.isPlatformAdmin, activeMembership],
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      if (target.kind === 'platform' || !target.id) {
        if (cancelled) return;
        setWorkspace({
          kind: 'platform',
          id: null,
          name: PLATFORM_NAME,
          logoAssetId: null,
          logoUrl: null,
          isLoading: false,
        });
        return;
      }

      setWorkspace((current) => ({
        ...current,
        kind: target.kind,
        id: target.id,
        isLoading: true,
      }));

      try {
        let name = '';
        let logoAssetId: string | null = null;

        if (target.kind === 'organization') {
          const { data } = await get<{ name: string; logoAssetId: string | null }>(
            '/api/organizations/me',
          );
          name = data.name;
          logoAssetId = data.logoAssetId;
        } else {
          const { data } = await get<{
            community: { name: string; logoAssetId: string | null };
          }>(`/api/communities/${target.id}/overview`);
          name = data.community.name;
          logoAssetId = data.community.logoAssetId;
        }

        if (logoAssetId) {
          objectUrl = await assetObjectUrl(logoAssetId);
        }

        if (cancelled) return;
        setWorkspace({
          kind: target.kind,
          id: target.id,
          name: name || PLATFORM_NAME,
          logoAssetId,
          logoUrl: objectUrl,
          isLoading: false,
        });
      } catch {
        if (cancelled) return;
        setWorkspace((current) => ({
          ...current,
          kind: target.kind,
          id: target.id,
          isLoading: false,
        }));
      }
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [target.kind, target.id, version]);

  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  const value = useMemo<WorkspaceState>(() => ({ ...workspace, refresh }), [workspace, refresh]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
