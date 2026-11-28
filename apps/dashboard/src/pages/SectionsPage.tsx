import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, get, patch, post } from '../lib/apiClient';
import { PageHeader } from '../components/layout/PageHeader';
import { ListToolbar } from '../components/layout/ListToolbar';
import { Pagination } from '../components/layout/Pagination';
import { FormDialog } from '../components/layout/FormDialog';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { LoadingState } from '../components/ui/loading-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { StructureTreeWorkspace } from '../components/admin/StructureTreeWorkspace';
import { fieldA11y, hasErrors, requiredError } from '../lib/form';
import { SECTION_TYPE_LABELS, sectionTypeLabel } from '../lib/section-types';
import { queryKeys } from '../lib/query-keys';

interface CommunityOption {
  id: string;
  name: string;
}

interface SectionRow {
  id: string;
  communityId: string;
  communityName: string;
  name: string;
  code: string | null;
  sectionType: string | null;
  sectionTypeLabel: string | null;
  levelCount: number;
  unitCount: number;
  status: string;
}

interface SectionListResponse {
  data: SectionRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface SectionFormState {
  communityId: string;
  name: string;
  code: string;
  sectionType: string;
  sectionTypeLabel: string;
}

const PAGE_SIZE = 10;
const SECTION_TYPE_OPTIONS = Object.keys(SECTION_TYPE_LABELS);

const EMPTY_COMMUNITIES: CommunityOption[] = [];
const EMPTY_SECTIONS: SectionRow[] = [];

function statusLabel(status: string): string {
  if (status === 'active') return 'Activa';
  if (status === 'inactive') return 'Inactiva';
  if (status === 'archived') return 'Archivada';
  return status;
}

function emptyForm(communityId = ''): SectionFormState {
  return { communityId, name: '', code: '', sectionType: 'tower', sectionTypeLabel: '' };
}

/**
 * Página compartida por `/platform/sections` y `/admin/sections`.
 *
 * La etiqueta de navegación es "Estructura" porque la página reúne las dos
 * vistas de la jerarquía: el listado plano de secciones y el árbol completo.
 * El alcance lo define la ruta: la consola de plataforma pide sus comunidades a
 * `/api/platform/communities`, mientras que la consola tenant usa
 * `/api/communities` (que ya viene filtrada por el membership activo).
 */
export function SectionsPage() {
  const { pathname } = useLocation();
  const isPlatformScope = pathname.startsWith('/platform');
  const queryClient = useQueryClient();

  const [view, setView] = useState<'list' | 'tree'>('list');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [communityFilter, setCommunityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SectionRow | null>(null);
  const [form, setForm] = useState<SectionFormState>(() => emptyForm());
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    communityId?: string;
    name?: string;
    sectionTypeLabel?: string;
  }>({});
  const [saving, setSaving] = useState(false);

  const communitiesQuery = useQuery({
    queryKey: isPlatformScope ? queryKeys.platformCommunities : queryKeys.tenantCommunities,
    queryFn: async () => {
      if (isPlatformScope) {
        const { data } = await get<{ data: CommunityOption[] }>(
          '/api/platform/communities?pageSize=100',
        );
        return data.data;
      }
      const { data } = await get<CommunityOption[]>('/api/communities');
      return data;
    },
  });

  const communities = communitiesQuery.data ?? EMPTY_COMMUNITIES;

  const sectionsQuery = useQuery<SectionListResponse>({
    queryKey: queryKeys.sectionsList({
      page,
      communityId: communityFilter,
      type: typeFilter,
      search: debouncedSearch,
    }),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (communityFilter !== 'all') params.set('communityId', communityFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      const { data } = await get<SectionListResponse>(`/api/sections?${params.toString()}`);
      return data;
    },
  });

  // Un cambio de filtro invalida la página en la que estaba el usuario.
  useEffect(() => {
    setPage(1);
  }, [communityFilter, typeFilter, debouncedSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const sections = sectionsQuery.data?.data ?? EMPTY_SECTIONS;
  const total = sectionsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(communities[0]?.id ?? ''));
    setFormError('');
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(section: SectionRow) {
    setEditing(section);
    setForm({
      communityId: section.communityId,
      name: section.name,
      code: section.code ?? '',
      sectionType: section.sectionType ?? 'other',
      sectionTypeLabel: section.sectionTypeLabel ?? '',
    });
    setFormError('');
    setFieldErrors({});
    setFormOpen(true);
  }

  async function saveSection(event: FormEvent) {
    event.preventDefault();
    setFormError('');

    const validation = {
      communityId: editing ? '' : requiredError(form.communityId, 'La comunidad'),
      name: requiredError(form.name, 'El nombre'),
      sectionTypeLabel:
        form.sectionType === 'other'
          ? requiredError(form.sectionTypeLabel, 'El nombre del tipo')
          : '',
    };
    setFieldErrors(validation);
    if (hasErrors(validation)) return;

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      sectionType: form.sectionType,
      ...(form.sectionType === 'other' ? { sectionTypeLabel: form.sectionTypeLabel.trim() } : {}),
    };

    try {
      if (editing) {
        await patch(`/api/sections/${editing.id}`, payload);
      } else {
        await post('/api/sections', { ...payload, communityId: form.communityId });
      }
      setFormOpen(false);
      setEditing(null);
      // La clave `sections` también cubre los listados cacheados de los dashboards.
      await queryClient.invalidateQueries({ queryKey: ['sections'] });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la sección.');
    } finally {
      setSaving(false);
    }
  }

  async function refreshAfterTreeChange() {
    // El árbol toca los mismos niveles 1: mantener sincronizados el listado de
    // secciones, las unidades y los contadores de los dashboards.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sections'] }),
      queryClient.invalidateQueries({ queryKey: ['units'] }),
    ]);
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Estructura"
        description="Secciones y árbol de ubicaciones de cada comunidad."
        actions={
          sectionsQuery.isFetching && !sectionsQuery.isPending && view === 'list' ? (
            <span role="status" className="text-xs text-muted-foreground">
              Actualizando…
            </span>
          ) : null
        }
      />

      <Tabs
        value={view}
        onValueChange={(value) => setView(value as 'list' | 'tree')}
        className="space-y-6"
      >
        <TabsList variant="line" className="self-start">
          <TabsTrigger value="list">Secciones</TabsTrigger>
          <TabsTrigger value="tree">Esquema</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          <FormDialog
            open={formOpen}
            onOpenChange={(open) => {
              setFormOpen(open);
              if (!open) {
                setEditing(null);
                setFormError('');
              }
            }}
            title={editing ? 'Editar sección' : 'Nueva sección'}
            description={
              editing
                ? 'Actualiza el nombre, el código y el tipo de la sección.'
                : 'Crea una sección de nivel 1 dentro de una comunidad.'
            }
            hideTrigger
          >
            <form onSubmit={saveSection} className="space-y-4" noValidate>
              {!editing && (
                <div className="space-y-1">
                  <Label htmlFor="section-community">Comunidad</Label>
                  <Select
                    value={form.communityId}
                    onValueChange={(value) => {
                      setForm({ ...form, communityId: value });
                      setFieldErrors((current) => ({ ...current, communityId: undefined }));
                    }}
                  >
                    <SelectTrigger
                      id="section-community"
                      className="w-full"
                      aria-label="Comunidad"
                      aria-invalid={Boolean(fieldErrors.communityId)}
                      aria-describedby={
                        fieldErrors.communityId ? 'section-community-error' : undefined
                      }
                    >
                      <SelectValue placeholder="Elige una comunidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {communities.map((community) => (
                        <SelectItem key={community.id} value={community.id}>
                          {community.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.communityId && (
                    <p
                      id="section-community-error"
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {fieldErrors.communityId}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="section-name">Nombre</Label>
                <Input
                  id="section-name"
                  value={form.name}
                  onChange={(event) => {
                    setForm({ ...form, name: event.target.value });
                    setFieldErrors((current) => ({ ...current, name: undefined }));
                  }}
                  required
                  {...fieldA11y('section-name', fieldErrors.name)}
                />
                {fieldErrors.name && (
                  <p id="section-name-error" role="alert" className="text-xs text-destructive">
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="section-code">Código</Label>
                <Input
                  id="section-code"
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="section-type">Tipo de sección</Label>
                <Select
                  value={form.sectionType}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      sectionType: value,
                      sectionTypeLabel: value === 'other' ? form.sectionTypeLabel : '',
                    })
                  }
                >
                  <SelectTrigger id="section-type" className="w-full" aria-label="Tipo de sección">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTION_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type} value={type}>
                        {SECTION_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.sectionType === 'other' && (
                <div className="space-y-1">
                  <Label htmlFor="section-type-label">Nombre del tipo</Label>
                  <Input
                    id="section-type-label"
                    value={form.sectionTypeLabel}
                    onChange={(event) => {
                      setForm({ ...form, sectionTypeLabel: event.target.value });
                      setFieldErrors((current) => ({ ...current, sectionTypeLabel: undefined }));
                    }}
                    placeholder="Ej. Torre, manzana, zona común"
                    required
                    {...fieldA11y('section-type-label', fieldErrors.sectionTypeLabel)}
                  />
                  {fieldErrors.sectionTypeLabel && (
                    <p
                      id="section-type-label-error"
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {fieldErrors.sectionTypeLabel}
                    </p>
                  )}
                </div>
              )}

              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear sección'}
              </Button>
            </form>
          </FormDialog>

          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Buscar por nombre o código…"
            actions={<Button onClick={openCreate}>Crear sección</Button>}
          >
            <Select value={communityFilter} onValueChange={setCommunityFilter}>
              <SelectTrigger className="w-56" aria-label="Filtrar por comunidad">
                <SelectValue placeholder="Todas las comunidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las comunidades</SelectItem>
                {communities.map((community) => (
                  <SelectItem key={community.id} value={community.id}>
                    {community.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44" aria-label="Filtrar por tipo de sección">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {SECTION_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {SECTION_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ListToolbar>

          {sectionsQuery.isPending ? (
            <LoadingState label="Cargando secciones…" />
          ) : sectionsQuery.isError ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <p>No se pudieron cargar las secciones. Reintenta en unos segundos.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void sectionsQuery.refetch()}
              >
                Reintentar
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Comunidad</TableHead>
                      <TableHead>Niveles</TableHead>
                      <TableHead>Unidades</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                          No hay secciones para mostrar
                        </TableCell>
                      </TableRow>
                    )}
                    {sections.map((section) => (
                      <TableRow key={section.id}>
                        <TableCell className="font-medium">{section.name}</TableCell>
                        <TableCell className="font-mono text-xs">{section.code ?? '—'}</TableCell>
                        <TableCell>
                          {sectionTypeLabel(section.sectionType, section.sectionTypeLabel)}
                        </TableCell>
                        <TableCell>{section.communityName}</TableCell>
                        <TableCell>{section.levelCount}</TableCell>
                        <TableCell>{section.unitCount}</TableCell>
                        <TableCell>
                          <Badge variant={section.status === 'active' ? 'secondary' : 'outline'}>
                            {statusLabel(section.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Editar ${section.name}`}
                            onClick={() => openEdit(section)}
                          >
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                disabled={sectionsQuery.isFetching}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="tree">
          <StructureTreeWorkspace
            communities={communities}
            onStructureChanged={() => void refreshAfterTreeChange()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
