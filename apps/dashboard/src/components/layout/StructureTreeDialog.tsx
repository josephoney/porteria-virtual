import { useCallback, useEffect, useState } from 'react';
import { RiAddLine, RiPencilLine } from '@remixicon/react';
import { get } from '../../lib/apiClient';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';
import { StructureForm } from './StructureForm';
import {
  LocationTreeTable,
  structureLevelName,
  type LocationNode,
  type LocationStructureInfo,
} from '../admin/LocationTreeTable';

interface StructureRow extends LocationStructureInfo {
  communityId: string;
  name: string;
}

type StructureTreeDialogProps = {
  communityId: string;
  communityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function levelPath(structure: StructureRow): string {
  return Array.from({ length: structure.levelCount }, (_, index) =>
    structureLevelName(structure, index + 1),
  ).join(' → ');
}

export function StructureTreeDialog({
  communityId,
  communityName,
  open,
  onOpenChange,
}: StructureTreeDialogProps) {
  const [structures, setStructures] = useState<StructureRow[]>([]);
  const [nodes, setNodes] = useState<LocationNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingStructure, setEditingStructure] = useState<StructureRow | null>(null);
  const [creatingStructure, setCreatingStructure] = useState(false);

  const structure = structures[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [structureResult, nodeResult] = await Promise.all([
        get<StructureRow[]>(`/api/location-structures?communityId=${communityId}`),
        get<LocationNode[]>(`/api/location-units?communityId=${communityId}`),
      ]);
      setStructures(structureResult.data);
      setNodes(nodeResult.data);
    } catch {
      setError('No se pudo cargar la estructura de la comunidad.');
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (!open) return;
    setEditingStructure(null);
    setCreatingStructure(false);
    void load();
  }, [open, load]);

  function closeStructureForm() {
    setEditingStructure(null);
    setCreatingStructure(false);
  }

  async function handleStructureSaved() {
    closeStructureForm();
    await load();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-h-[85vh] sm:max-w-4xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Estructura · {communityName}</DialogTitle>
            <DialogDescription>
              Niveles y jerarquía de la comunidad. Las secciones y unidades se crean y editan desde
              Unidades.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
              <Button variant="outline" size="sm" className="ml-3" onClick={() => void load()}>
                Reintentar
              </Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : !structure ? (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">Sin estructura definida.</p>
              <Button size="sm" onClick={() => setCreatingStructure(true)}>
                <RiAddLine />
                Definir estructura
              </Button>
            </div>
          ) : (
            <>
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-semibold">Estructura de la comunidad</p>
                  <p className="text-xs text-muted-foreground">
                    {structure.levelCount} niveles · {levelPath(structure)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditingStructure(structure)}>
                  <RiPencilLine />
                  Editar estructura
                </Button>
              </section>

              <LocationTreeTable structure={structure} nodes={nodes} mode="readonly" />

              <p className="text-xs text-muted-foreground">
                Para agregar, renombrar o archivar {structure.level1Name.toLowerCase()}s, usa la
                sección Unidades.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingStructure) || creatingStructure}
        onOpenChange={(next) => {
          if (!next) closeStructureForm();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingStructure ? 'Editar estructura' : 'Crear estructura'}</DialogTitle>
            <DialogDescription>
              Define la cantidad de niveles y el nombre de cada uno.
            </DialogDescription>
          </DialogHeader>
          {!structure && (
            <p className="text-sm text-muted-foreground">
              La estructura de {communityName} todavía no existe. Créala antes de cargar secciones y
              unidades.
            </p>
          )}
          <StructureForm
            communities={[{ id: communityId, name: communityName }]}
            initial={editingStructure ?? undefined}
            onSaved={() => void handleStructureSaved()}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
