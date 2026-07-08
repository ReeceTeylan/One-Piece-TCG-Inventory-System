import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import type { TrendPoint } from '@/types';
import { peso, fmtDate } from '@/lib/utils';

// Custom tooltip: Revenue, Profit, Cards Sold, Quantity, % growth vs previous point.
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as TrendPoint & { _prevRevenue?: number };
  const prev = p._prevRevenue ?? 0;
  const growth = prev === 0 ? (p.revenue > 0 ? 100 : 0) : ((p.revenue - prev) / prev) * 100;
  const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex justify-between gap-6 py-0.5"><span className="text-muted-foreground">{label}</span><span className="font-semibold" style={color ? { color } : undefined}>{value}</span></div>
  );
  return (
    <div className="min-w-[180px] rounded-lg border bg-card p-3 text-xs shadow-lg">
      <div className="mb-1.5 border-b pb-1.5 font-semibold">{fmtDate(p.date)}</div>
      <Row label="Revenue" value={peso(p.revenue)} />
      <Row label="Profit" value={peso(p.profit)} color="hsl(var(--success))" />
      <Row label="Cards sold" value={String(p.cardsSold)} />
      <Row label="Quantity" value={String(p.cardsSold)} />
      <Row label="Growth" value={`${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth).toFixed(1)}%`} color={growth >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
    </div>
  );
}

export function TrendChart({ data, metric = 'revenue' }: { data: TrendPoint[]; metric?: 'revenue' | 'profit' | 'cardsSold' }) {
  // attach previous-point revenue for growth calc
  const enriched = data.map((d, i) => ({ ...d, _prevRevenue: i > 0 ? data[i - 1].revenue : 0 }));
  const color = metric === 'profit' ? 'hsl(var(--success))' : 'hsl(var(--ring))';
  return (
    <ResponsiveContainer width="100%" height={230}>
      <LineChart data={enriched} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={48}
          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '3 3' }} />
        <Line type="monotone" dataKey={metric} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
