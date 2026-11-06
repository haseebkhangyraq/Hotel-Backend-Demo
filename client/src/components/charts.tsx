import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts';
import type { ReactNode } from 'react';

const RT = {
  fontFamily: 'Manrope, sans-serif',
  fontSize: 12,
};

function ChartBox({ children, height = 260 }: { children: ReactNode; height?: number }) {
  return <div style={{ height }} className="w-full">{children}</div>;
}

export function OccupancyArea({ data, dataKey = 'occupancy', color = '#13293B', height = 220, yMax }: {
  data: { date: string; occupancy: number; revenue?: number }[]; dataKey?: string; color?: string; height?: number; yMax?: number;
}) {
  return (
    <ChartBox height={height}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="#E7E9ED" vertical={false} />
          <XAxis dataKey="date" tick={{ ...RT, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ ...RT, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={[0, yMax ?? 100]} unit={dataKey === 'occupancy' ? '%' : ''} />
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E7E9ED', ...RT }} formatter={(v) => [dataKey === 'occupancy' ? `${v}%` : v, dataKey === 'occupancy' ? 'Occupancy' : 'Value']} />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={`url(#g-${dataKey})`} activeDot={{ r: 4, fill: color, strokeWidth: 2, stroke: '#fff' }} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

const GOLD_BINS = ['#0D1B28', '#1B3A50', '#33638C', '#C6A15B', '#D5B478', '#E5CDA0'];

export function RevenueBars({ data, height = 220, moneyKey = 'revenue' }: { data: { date: string; revenue?: number; amount?: number }[]; height?: number; moneyKey?: string }) {
  return (
    <ChartBox height={height}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="#E7E9ED" vertical={false} />
          <XAxis dataKey="date" tick={{ ...RT, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ ...RT, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={54} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #E7E9ED', ...RT }}
            formatter={(v: number) => [`₨ ${Number(v).toLocaleString()}`, 'Revenue']}
            cursor={{ fill: 'rgba(198,161,91,0.08)' }}
          />
          <Bar dataKey={moneyKey} radius={[6, 6, 0, 0]} maxBarSize={26}>
            {data.map((_, i) => <Cell key={i} fill={GOLD_BINS[i % GOLD_BINS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

export function StatusDonut({ data }: { data: { name: string; value: number }[] }) {
  const COLOR: Record<string, string> = {
    Available: '#10B981', Reserved: '#6366F1', Occupied: '#0284C7', Dirty: '#F59E0B', Cleaning: '#06B6D4', Maintenance: '#F43F5E',
  };
  return (
    <div className="relative" style={{ height: 210 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} strokeWidth={0} cornerRadius={4}>
            {data.map((d) => <Cell key={d.name} fill={COLOR[d.name] || '#94A3B8'} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E7E9ED', ...RT }} />
          <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ ...RT, color: '#475569', fontWeight: 600 }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 grid place-items-center pointer-events-none" style={{ paddingBottom: 26 }}>
        <div className="text-center -translate-y-2">
          <div className="text-[22px] font-extrabold text-ink-900 leading-none font-display">{data.reduce((s, d) => s + d.value, 0)}</div>
          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mt-1">Rooms</div>
        </div>
      </div>
    </div>
  );
}
