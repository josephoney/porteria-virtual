import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { get } from '../../lib/apiClient';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Skeleton } from '../ui/skeleton';

type Range = '7d' | '30d' | '90d';

interface EventBucket {
  time: string;
  [key: string]: string | number;
}

interface Point {
  date: string;
  llamadas: number;
  puertas: number;
}

function rangeToDays(range: Range): number {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  return 90;
}

export function ChartAreaInteractive() {
  const [range, setRange] = useState<Range>('30d');
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - rangeToDays(range));

    get<{ buckets: EventBucket[] }>(
      `/api/reports/event-breakdown?from=${from.toISOString()}&to=${to.toISOString()}&bucket=day`,
    )
      .then(({ data: result }) => {
        if (cancelled) return;
        setData(
          result.buckets.map((bucket) => ({
            date: new Date(bucket.time).toLocaleDateString('es-AR', {
              day: '2-digit',
              month: 'short',
            }),
            llamadas: Number(bucket['call.started'] ?? 0),
            puertas: Number(bucket['door.open'] ?? 0),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la actividad.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="font-heading">Actividad</CardTitle>
        <CardDescription>Llamadas y aperturas de puerta por día.</CardDescription>
        <CardAction>
          <Select value={range} onValueChange={(value) => setRange(value as Range)}>
            <SelectTrigger className="w-36" aria-label="Rango de actividad">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="90d">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading && <Skeleton className="h-[250px] w-full" />}
        {!loading && error && (
          <p className="py-16 text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && data.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Sin actividad para el período seleccionado.
          </p>
        )}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fill-calls" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fill-doors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                stroke="var(--color-muted-foreground)"
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
                stroke="var(--color-muted-foreground)"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-popover)',
                  color: 'var(--color-popover-foreground)',
                }}
              />
              <Area
                dataKey="puertas"
                name="Puertas"
                type="natural"
                fill="url(#fill-doors)"
                stroke="var(--color-secondary)"
                stackId="a"
              />
              <Area
                dataKey="llamadas"
                name="Llamadas"
                type="natural"
                fill="url(#fill-calls)"
                stroke="var(--color-primary)"
                stackId="a"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
