import { Navigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { AccessBitacoraView } from '../components/admin/AccessBitacoraView';
import { EventHistoryView } from '../components/admin/EventHistoryView';
import { ReportsPanel } from '../components/admin/ReportsPanel';

const meta = {
  bitacora: {
    title: 'Bitácora de accesos',
    description: 'Registro inmutable de ingresos, salidas y novedades por lugar físico.',
  },
  'bitacora-accesos': {
    title: 'Bitácora de accesos',
    description: 'Registro inmutable de ingresos, salidas y novedades por lugar físico.',
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

type Section = keyof typeof meta;

const platformSections: Section[] = ['bitacora', 'reports', 'history'];
const tenantSections: Section[] = ['bitacora-accesos', 'reports'];

export function AnalysisPage({ scope = 'tenant' }: { scope?: 'tenant' | 'platform' }) {
  const location = useLocation();
  const requested = location.pathname.split('/').pop() ?? 'bitacora';

  /**
   * La vista técnica dejó de pertenecer al tenant: Historial es solo del
   * superadmin y su API responde 403 al resto. El enlace viejo
   * `/analysis/bitacora` redirige a la bitácora legible en lugar de quedar
   * apuntando a una pantalla que ya no puede existir.
   */
  if (requested === 'bitacora' && scope === 'tenant') {
    return <Navigate to="/analysis/bitacora-accesos" replace />;
  }

  const allowed = scope === 'platform' ? platformSections : tenantSections;
  const fallback = scope === 'platform' ? '/platform/bitacora' : '/analysis/bitacora-accesos';

  if (!(allowed as string[]).includes(requested)) {
    return <Navigate to={fallback} replace />;
  }

  const section = requested as Section;
  const page = meta[section];

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <PageHeader title={page.title} description={page.description} />
      {section === 'bitacora' && <AccessBitacoraView compact poll />}
      {section === 'bitacora-accesos' && <AccessBitacoraView compact poll />}
      {section === 'reports' && <ReportsPanel />}
      {section === 'history' && <EventHistoryView />}
    </div>
  );
}
