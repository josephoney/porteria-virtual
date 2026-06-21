import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ChartProps {
  data: Record<string, unknown>[];
  type: 'bar' | 'line';
  xKey: string;
  yKeys: { key: string; name: string; color: string }[];
  height?: number;
}

export function ReportChart({ data, type, xKey, yKeys, height = 250 }: ChartProps) {
  if (data.length === 0) {
    return (
      <p style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'center', padding: 40 }}>
        Sin datos para el período seleccionado
      </p>
    );
  }

  const Chart = type === 'bar' ? BarChart : LineChart;
  const DataComponent = type === 'bar' ? Bar : Line;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey={xKey} stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} />
        <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--popover)',
            color: 'var(--popover-foreground)',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {yKeys.map((k) => (
          <DataComponent key={k.key} dataKey={k.key} name={k.name} fill={k.color} stroke={k.color} radius={type === 'bar' ? 4 : undefined} />
        ))}
      </Chart>
    </ResponsiveContainer>
  );
}
