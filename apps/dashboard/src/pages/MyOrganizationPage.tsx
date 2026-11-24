import { useCallback, useEffect, useState } from 'react';
import { assetObjectUrl, get, patch, post, upload } from '../lib/apiClient';
import { COUNTRIES } from '../lib/countries';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { DetailField, DetailGrid } from '../components/ui/detail-field';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { LogoUpload } from '../components/ui/logo-upload';
import { Skeleton } from '../components/ui/skeleton';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  nit: string | null;
  phone: string | null;
  address: string | null;
  municipality: string | null;
  department: string | null;
  country: string | null;
  welcomeMessage: string | null;
  /** Days the organization keeps visitor identity in the access record. */
  retentionDays: number;
  legalRepresentativePersonId: string | null;
  logoAssetId: string | null;
  profileCompletedAt: string | null;
}

interface RetentionRun {
  id: string;
  ranAt: string;
  retentionDays: number;
  dryRun: boolean;
  anonymizedPasses: number;
  anonymizedScans: number;
  anonymizedEntries: number;
}

interface RetentionHold {
  id: string;
  communityId: string | null;
  fromDate: string;
  toDate: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
  releasedAt: string | null;
}

/** Windows the platform accepts; the API rejects anything else. */
const RETENTION_WINDOWS = [30, 60, 90] as const;

interface PersonOption {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string | null;
  contactEmail: string | null;
}

export function MyOrganizationPage() {
  const [organization, setOrganization] = useState<OrganizationProfile | null>(null);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [runs, setRuns] = useState<RetentionRun[]>([]);
  const [holds, setHolds] = useState<RetentionHold[]>([]);
  const [holdForm, setHoldForm] = useState({ fromDate: '', toDate: '', reason: '', expiresAt: '' });
  const [creatingHold, setCreatingHold] = useState(false);
  const [holdError, setHoldError] = useState('');
  const [form, setForm] = useState({
    nit: '',
    phone: '',
    address: '',
    municipality: '',
    department: '',
    country: '',
    welcomeMessage: '',
    retentionDays: '30',
    legalRepresentativePersonId: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const { refresh: refreshWorkspace } = useWorkspace();

  useEffect(() => {
    const assetId = organization?.logoAssetId;
    if (!assetId) {
      setLogoPreview('');
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    assetObjectUrl(assetId)
      .then((url) => {
        objectUrl = url;
        if (!cancelled) setLogoPreview(url ?? '');
      })
      .catch(() => {
        if (!cancelled) setLogoPreview('');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [organization?.logoAssetId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [result, peopleResult, runsResult, holdsResult] = await Promise.all([
        get<OrganizationProfile>('/api/organizations/me'),
        get<PersonOption[]>('/api/people?pageSize=100'),
        get<RetentionRun[]>('/api/organizations/me/retention-runs'),
        get<RetentionHold[]>('/api/organizations/me/retention-holds'),
      ]);
      setOrganization(result.data);
      setPeople(peopleResult.data);
      setRuns(runsResult.data);
      setHolds(holdsResult.data);
      setForm({
        nit: result.data.nit ?? '',
        phone: result.data.phone ?? '',
        address: result.data.address ?? '',
        municipality: result.data.municipality ?? '',
        department: result.data.department ?? '',
        country: result.data.country ?? '',
        welcomeMessage: result.data.welcomeMessage ?? '',
        retentionDays: String(result.data.retentionDays ?? 30),
        legalRepresentativePersonId: result.data.legalRepresentativePersonId ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la organización.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('kind', 'organization_logo');
      formData.append('file', file);
      const result = await upload<{ id: string }>('/api/assets', formData);
      await patch('/api/organizations/me', { logoAssetId: result.data.id });
      setSaved(true);
      await load();
      refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el logo.');
    } finally {
      setLogoUploading(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const result = await patch<OrganizationProfile>('/api/organizations/me', {
        nit: form.nit || null,
        phone: form.phone || null,
        address: form.address || null,
        municipality: form.municipality || null,
        department: form.department || null,
        country: form.country || null,
        legalRepresentativePersonId: form.legalRepresentativePersonId || null,
        welcomeMessage: form.welcomeMessage || null,
        retentionDays: Number(form.retentionDays) || 30,
      });
      setOrganization(result.data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function createHold(event: React.FormEvent) {
    event.preventDefault();
    setCreatingHold(true);
    setHoldError('');
    try {
      await post('/api/organizations/me/retention-holds', {
        fromDate: holdForm.fromDate,
        toDate: holdForm.toDate,
        reason: holdForm.reason,
        expiresAt: holdForm.expiresAt,
      });
      setHoldForm({ fromDate: '', toDate: '', reason: '', expiresAt: '' });
      await load();
    } catch (err) {
      setHoldError(err instanceof Error ? err.message : 'No se pudo crear la preservación.');
    } finally {
      setCreatingHold(false);
    }
  }

  async function releaseHold(id: string) {
    setHoldError('');
    try {
      await post(`/api/organizations/me/retention-holds/${id}/release`, {});
      await load();
    } catch (err) {
      setHoldError(err instanceof Error ? err.message : 'No se pudo liberar la preservación.');
    }
  }

  const currentWindow = Number(form.retentionDays);
  const windowOptions = (RETENTION_WINDOWS as readonly number[]).includes(currentWindow)
    ? [...RETENTION_WINDOWS]
    : [currentWindow, ...RETENTION_WINDOWS];

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Mi Organización"
        description="Completa los datos de contacto, legales y la bienvenida de tu organización."
      />

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          Perfil actualizado.
        </p>
      )}

      <div className="rounded-xl border border-border p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {organization?.profileCompletedAt ? 'Perfil completo' : 'Perfil incompleto'}
          </span>
          {organization?.profileCompletedAt && (
            <span className="rounded-full border border-border px-2 py-1 text-xs">
              Datos completados
            </span>
          )}
        </div>
        <DetailGrid className="mb-4">
          <DetailField
            label="Organización"
            value={organization?.name}
            valueClassName="text-base font-bold"
          />
          <DetailField
            label="Slug"
            value={organization?.slug}
            valueClassName="font-mono text-sm font-normal"
          />
          <DetailField label="Municipio" value={organization?.municipality} />
          <DetailField label="Departamento" value={organization?.department} />
          <DetailField label="País" value={organization?.country} />
        </DetailGrid>

        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <LogoUpload
              id="org-logo"
              label="Logo de la organización"
              previewUrl={logoPreview || null}
              hasLogo={Boolean(organization?.logoAssetId)}
              onSelect={uploadLogo}
              disabled={logoUploading}
              hint="PNG, JPG o WEBP. Máximo 500 KB. Se recomienda una imagen cuadrada."
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-nit">NIT</Label>
            <Input
              id="org-nit"
              value={form.nit}
              onChange={(event) => setForm({ ...form, nit: event.target.value })}
              placeholder="Sin dígito de verificación"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-phone">Teléfono</Label>
            <Input
              id="org-phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="org-address">Dirección</Label>
            <Input
              id="org-address"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-municipality">Municipio</Label>
            <Input
              id="org-municipality"
              value={form.municipality}
              onChange={(event) => setForm({ ...form, municipality: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-department">Departamento</Label>
            <Input
              id="org-department"
              value={form.department}
              onChange={(event) => setForm({ ...form, department: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-country">País</Label>
            <select
              id="org-country"
              className="h-9 w-full rounded border border-border bg-card px-2 text-sm"
              value={form.country}
              onChange={(event) => setForm({ ...form, country: event.target.value })}
            >
              <option value="">Sin especificar</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="org-legal-representative">Representante legal</Label>
            <select
              id="org-legal-representative"
              className="h-9 w-full rounded border border-border bg-card px-2 text-sm"
              value={form.legalRepresentativePersonId}
              onChange={(event) =>
                setForm({
                  ...form,
                  legalRepresentativePersonId: event.target.value,
                })
              }
            >
              <option value="">Sin asignar</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                  {person.documentNumber ? ` · ${person.documentNumber}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="org-welcome">Mensaje de bienvenida</Label>
            <Input
              id="org-welcome"
              value={form.welcomeMessage}
              onChange={(event) => setForm({ ...form, welcomeMessage: event.target.value })}
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="org-retention">Retención de datos</Label>
            <select
              id="org-retention"
              className="h-9 w-full min-w-0 rounded-3xl border border-transparent bg-input/50 px-3 py-1 text-base outline-none focus-visible:border-ring md:text-sm"
              value={form.retentionDays}
              onChange={(event) => setForm({ ...form, retentionDays: event.target.value })}
            >
              {windowOptions.map((days) => (
                <option key={days} value={String(days)}>
                  {days} días
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Días que se conserva la identidad del visitante con nombre y documento legibles.
              Después de ese plazo el registro permanece —fecha, portería, resultado y turno— pero
              el nombre, el documento, la placa y los acompañantes se reemplazan por un valor
              anónimo. El mínimo es 30 días porque una investigación de seguridad suele abrirse
              semanas después del hecho.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-bold">Preservaciones</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Si ocurrió un incidente, preserva el rango de fechas que lo cubre antes de que la
          retención lo anonimice. La preservación no impide la anonimización de otros días y vence
          sola en la fecha que indiques.
        </p>

        {holds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay preservaciones registradas.</p>
        ) : (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-2 text-left font-medium">Desde</th>
                  <th className="pb-2 text-left font-medium">Hasta</th>
                  <th className="pb-2 text-left font-medium">Motivo</th>
                  <th className="pb-2 text-left font-medium">Vence</th>
                  <th className="pb-2 text-left font-medium">Estado</th>
                  <th className="pb-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {holds.map((hold) => {
                  const released = hold.releasedAt != null;
                  return (
                    <tr key={hold.id} className="border-t border-border">
                      <td className="py-2">{formatDay(hold.fromDate)}</td>
                      <td className="py-2">{formatDay(hold.toDate)}</td>
                      <td className="py-2">{hold.reason}</td>
                      <td className="py-2">{formatDay(hold.expiresAt.slice(0, 10))}</td>
                      <td className="py-2">
                        {released ? 'Liberada' : 'Activa'}
                        {hold.communityId == null && !released ? ' · Toda la organización' : ''}
                      </td>
                      <td className="py-2 text-right">
                        {released ? null : (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => releaseHold(hold.id)}
                          >
                            Liberar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <form className="grid gap-3 sm:grid-cols-2" onSubmit={createHold}>
          <div className="space-y-1">
            <Label htmlFor="hold-from">Desde</Label>
            <Input
              id="hold-from"
              type="date"
              required
              value={holdForm.fromDate}
              onChange={(event) => setHoldForm({ ...holdForm, fromDate: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hold-to">Hasta</Label>
            <Input
              id="hold-to"
              type="date"
              required
              value={holdForm.toDate}
              onChange={(event) => setHoldForm({ ...holdForm, toDate: event.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="hold-reason">Motivo</Label>
            <Input
              id="hold-reason"
              required
              minLength={5}
              value={holdForm.reason}
              onChange={(event) => setHoldForm({ ...holdForm, reason: event.target.value })}
              placeholder="Por ejemplo: incidente del 18 de noviembre, caso 2026-114"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hold-expires">Vence</Label>
            <Input
              id="hold-expires"
              type="date"
              required
              value={holdForm.expiresAt}
              onChange={(event) => setHoldForm({ ...holdForm, expiresAt: event.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="outline" disabled={creatingHold}>
              {creatingHold ? 'Creando…' : 'Preservar rango'}
            </Button>
          </div>
        </form>

        {holdError && <p className="mt-2 text-sm text-destructive">{holdError}</p>}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-bold">Corridas de retención</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Cada corrida registra cuántos registros salieron de la ventana. Mientras la escritura esté
          desactivada, la corrida simula y no modifica datos.
        </p>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay corridas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-2 text-left font-medium">Fecha</th>
                  <th className="pb-2 text-right font-medium">Días</th>
                  <th className="pb-2 text-left font-medium">Modo</th>
                  <th className="pb-2 text-right font-medium">Pases</th>
                  <th className="pb-2 text-right font-medium">Escaneos</th>
                  <th className="pb-2 text-right font-medium">Bitácora</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-border">
                    <td className="py-2">{new Date(run.ranAt).toLocaleString('es-CO')}</td>
                    <td className="py-2 text-right font-mono">{run.retentionDays}</td>
                    <td className="py-2">{run.dryRun ? 'Simulación' : 'Aplicada'}</td>
                    <td className="py-2 text-right font-mono">{run.anonymizedPasses}</td>
                    <td className="py-2 text-right font-mono">{run.anonymizedScans}</td>
                    <td className="py-2 text-right font-mono">{run.anonymizedEntries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** `YYYY-MM-DD` (or an ISO timestamp) to a local day, without shifting the date. */
function formatDay(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}
