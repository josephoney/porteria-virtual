import { useCallback, useEffect, useState } from 'react';
import { assetObjectUrl, get, patch, upload } from '../lib/apiClient';
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
  legalRepresentativePersonId: string | null;
  logoAssetId: string | null;
  profileCompletedAt: string | null;
}

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
  const [form, setForm] = useState({
    nit: '',
    phone: '',
    address: '',
    municipality: '',
    department: '',
    country: '',
    welcomeMessage: '',
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
      const [result, peopleResult] = await Promise.all([
        get<OrganizationProfile>('/api/organizations/me'),
        get<PersonOption[]>('/api/people?pageSize=100'),
      ]);
      setOrganization(result.data);
      setPeople(peopleResult.data);
      setForm({
        nit: result.data.nit ?? '',
        phone: result.data.phone ?? '',
        address: result.data.address ?? '',
        municipality: result.data.municipality ?? '',
        department: result.data.department ?? '',
        country: result.data.country ?? '',
        welcomeMessage: result.data.welcomeMessage ?? '',
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
      });
      setOrganization(result.data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  }

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
        description="Completá los datos de contacto, legales y la bienvenida de tu organización."
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
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
