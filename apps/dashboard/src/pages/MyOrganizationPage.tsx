import { useCallback, useEffect, useState } from 'react';
import { get, patch, upload } from '../lib/apiClient';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';

interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  nit: string | null;
  phone: string | null;
  address: string | null;
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
    welcomeMessage: '',
    legalRepresentativePersonId: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

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

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('kind', 'organization_logo');
      formData.append('file', file);
      const result = await upload<{ id: string }>('/api/assets', formData);
      await patch('/api/organizations/me', { logoAssetId: result.data.id });
      setLogoPreview(URL.createObjectURL(file));
      setSaved(true);
      await load();
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
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Organización
            </p>
            <p className="font-medium">{organization?.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Slug
            </p>
            <p className="font-mono text-sm">{organization?.slug}</p>
          </div>
        </div>

        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="org-logo">Logo de la organización</Label>
            <div className="flex items-center gap-3">
              <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo de la organización"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {organization?.logoAssetId ? 'Logo cargado' : 'Sin logo'}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <Input
                  id="org-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={uploadLogo}
                  disabled={logoUploading}
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPG o WEBP. Máximo 500 KB. Se recomienda una imagen cuadrada.
                </p>
              </div>
            </div>
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
              onChange={(event) =>
                setForm({ ...form, welcomeMessage: event.target.value })
              }
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
