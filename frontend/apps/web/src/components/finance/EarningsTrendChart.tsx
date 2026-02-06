import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatEuros, centsToEuros } from '@doctor-tracker/shared/utils/currency';
import type { Projection } from '@doctor-tracker/shared/types/finance';

interface Props {
  projections: Projection[];
}

export function EarningsTrendChart({ projections }: Props) {
  if (projections.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 h-80 flex items-center justify-center">
        <p className="text-gray-400 text-sm">No earnings data yet. Complete shifts to see trends.</p>
      </div>
    );
  }

  const data = projections.map((p) => ({
    month: new Date(p.month + '-01').toLocaleDateString('en', { month: 'short' }),
    actual: p.actual_gross > 0 ? centsToEuros(p.actual_gross) : null,
    projected: centsToEuros(p.projected_gross),
    isActual: p.is_actual,
  }));

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-semibold mb-4">Earnings Trend</h2>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
          <YAxis
            tick={{ fontSize: 12, fill: '#9ca3af' }}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number | undefined, name: string | undefined) => [
              formatEuros(Math.round((value ?? 0) * 100)),
              name === 'actual' ? 'Actual' : 'Projected',
            ]}
            contentStyle={{
              backgroundColor: 'rgba(255,255,255,0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.75rem' }}
            formatter={(value: string) => (value === 'actual' ? 'Actual' : 'Projected')}
          />
          <Bar
            dataKey="actual"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
          <Line
            dataKey="projected"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: '#a78bfa' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
