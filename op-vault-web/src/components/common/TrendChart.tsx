import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import type { TrendPoint } from '@/types';
import { peso, fmtDate } from '@/lib/utils';

type Metric = 'revenue' | 'profit' | 'cardsSold';

// Custom tooltip: Revenue, Profit, Cards Sold, Quantity, % growth vs previous point.
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as TrendPoint & { _prevProfit?: number };
  const prev = p._prevProfit ?? 0;
  const growth = prev === 0 ? (p.profit > 0 ? 100 : 0) : ((p.profit - prev) / prev) * 100;
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
      <Row label="Profit growth" value={`${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth).toFixed(1)}%`} color={growth >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[15px] font-bold tabular-nums">{value}</div>
    </div>
  );
}

export function TrendChart({ data, metric = 'revenue', monthly }: { data: TrendPoint[]; metric?: Metric; monthly?: TrendPoint[] }) {
  // attach previous-point profit for growth calc
  const enriched = data.map((d, i) => ({ ...d, _prevProfit: i > 0 ? data[i - 1].profit : 0 }));
  const color = metric === 'profit' ? 'hsl(var(--success))' : 'hsl(var(--ring))';
  const gradId = `trend-fill-${metric}`;

  const values = data.map((d) => Number(d[metric] ?? 0));
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const bestIdx = values.length ? values.reduce((best, v, i) => (v > values[best] ? i : best), 0) : -1;
  const fmt = (v: number) => (metric === 'cardsSold' ? String(Math.round(v)) : peso(v));

  const monthlyVals = (monthly ?? []).map((m) => Number(m[metric] ?? 0));
  const bestMonthIdx = monthlyVals.length
    ? monthlyVals.reduce((best, v, i) => (v > monthlyVals[best] ? i : best), 0)
    : -1;

  return (
    <div>
      {bestIdx >= 0 && (
        <div className="mb-3 flex flex-wrap gap-x-8 gap-y-3 border-b pb-3">
          <Summary label="Best day" value={`${fmt(values[bestIdx])} · ${fmtDate(data[bestIdx].date)}`} />
          {bestMonthIdx >= 0 && (
            <Summary label="Best month"
              value={`${fmt(monthlyVals[bestMonthIdx])} · ${new Date(monthly![bestMonthIdx].date).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}`} />
          )}
          <Summary label="Daily average" value={fmt(avg)} />
        </div>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={enriched} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {/* Fading fill gives the line some mass without adding a new colour. */}
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 6" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={48}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '3 3' }} />
          {/* Average line makes it obvious at a glance which days beat the norm. */}
          <ReferenceLine y={avg} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Area type="monotone" dataKey={metric} stroke={color} strokeWidth={2.5} fill={`url(#${gradId})`}
            dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}