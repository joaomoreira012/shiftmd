import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { formatEuros, centsToEuros } from '@doctor-tracker/shared/utils/currency';
import type { WorkplaceEarnings } from '@doctor-tracker/shared/types/finance';
import type { Workplace } from '@doctor-tracker/shared/types/workplace';

interface Props {
  workplaceEarnings: WorkplaceEarnings[];
  workplaces: Workplace[];
}

export function WorkplaceBreakdownChart({ workplaceEarnings, workplaces }: Props) {
  if (workplaceEarnings.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 h-80 flex items-center justify-center">
        <p className="text-gray-400 text-sm">No workplace earnings data yet.</p>
      </div>
    );
  }

  const data = workplaceEarnings.map((we) => {
    const wp = workplaces.find((w) => w.id === we.workplace_id);
    return {
      name: we.workplace_name || wp?.name || 'Unknown',
      value: centsToEuros(we.gross),
      color: we.color || wp?.color || '#6B7280',
      hours: we.hours,
      shifts: we.shift_count,
    };
  });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-semibold mb-4">By Workplace</h2>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | undefined) => formatEuros(Math.round((value ?? 0) * 100))}
            contentStyle={{
              backgroundColor: 'rgba(255,255,255,0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.75rem' }}
            formatter={(value: string) => <span className="text-gray-600 dark:text-gray-400">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Stats under chart */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-gray-500 truncate">{d.name}</span>
            <span className="font-medium ml-auto">{d.hours.toFixed(0)}h</span>
          </div>
        ))}
      </div>
    </div>
  );
}
