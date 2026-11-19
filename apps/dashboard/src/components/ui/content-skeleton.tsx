import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Skeleton } from './skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

/**
 * Filas de esqueleto dentro de una tabla real. El encabezado y los anchos de
 * columna se mantienen montados mientras cargan los datos, así la página no
 * muestra un cuerpo de tabla vacío ni salta cuando el contenido llega.
 */
export function TableSkeletonRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex} aria-hidden>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={columnIndex}>
              <Skeleton className="h-4 w-full max-w-40" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Tabla completa en carga: mismo encabezado y cantidad de columnas que la tabla real. */
export function TableSkeleton({ headers, rows = 5 }: { headers: string[]; rows?: number }) {
  return (
    <div className="loading-fade-in overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableSkeletonRows columns={headers.length} rows={rows} />
        </TableBody>
      </Table>
    </div>
  );
}

/** Tarjetas de resumen en carga con la misma grilla y alto que `SectionCards`. */
export function CardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="loading-fade-in grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="@container/card" aria-hidden>
          <CardHeader>
            <CardDescription>
              <Skeleton className="h-4 w-24" />
            </CardDescription>
            <CardTitle>
              <Skeleton className="h-8 w-16" />
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5">
            <Skeleton className="h-4 w-32" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

/** Tarjeta de gráfico en carga con la altura reservada del gráfico real. */
export function ChartSkeleton() {
  return (
    <Card className="loading-fade-in @container/card" aria-hidden>
      <CardHeader>
        <CardTitle className="font-heading">Actividad</CardTitle>
        <CardDescription>Llamadas y aperturas de puerta por día.</CardDescription>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[250px] w-full" />
      </CardContent>
    </Card>
  );
}
