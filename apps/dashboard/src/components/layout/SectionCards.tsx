import { Badge } from '../ui/badge';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';

export interface SectionCardItem {
  label: string;
  value: string | number;
  description?: string;
  trend?: string;
  trendVariant?: 'default' | 'secondary' | 'outline';
}

export function SectionCards({ items }: { items: SectionCardItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} className="@container/card">
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {item.value}
            </CardTitle>
          </CardHeader>
          {(item.description || item.trend) && (
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              {item.trend && (
                <Badge variant={item.trendVariant ?? 'outline'}>{item.trend}</Badge>
              )}
              {item.description && (
                <p className="text-muted-foreground">{item.description}</p>
              )}
            </CardFooter>
          )}
        </Card>
      ))}
    </div>
  );
}
