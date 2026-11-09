import { Navigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { BitacoraView } from '../components/admin/BitacoraView';
import { ReportsPanel } from '../components/admin/ReportsPanel';

const meta = {
  bitacora: {
    title: 'Bitácora',
    description: 'Registro legible de ingresos por portería.',
  },
  reports: {
    title: 'Reportes',
    description: 'Métricas de accesos, llamadas y puertas.',
  },
  history: {
    title: 'Historial',
    description: 'Detalle técnico para diagnóstico de accesos y códigos.',
  },
} as const;

export function AnalysisPage({ scope = 'tenant' }: { scope?: 'tenant' | 'platform' }) {
  const location = useLocation();
  const requested = location.pathname.split('/').pop() ?? 'bitacora';
  const fallback = scope === 'platform' ? '/platform/bitacora' : '/analysis/bitacora';

  if (!(requested in meta) || (requested === 'history' && scope !== 'platform')) {
    return <Navigate to={fallback} replace />;
  }

  const section = requested as keyof typeof meta;
  const page = meta[section];

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <PageHeader title={page.title} description={page.description} />
      {section === 'bitacora' && <BitacoraView />}
      {section === 'reports' && <ReportsPanel />}
      {section === 'history' && scope === 'platform' && <BitacoraView />}
    </div>
  );
}
