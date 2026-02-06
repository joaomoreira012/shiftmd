import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { formatEuros } from '@doctor-tracker/shared/utils/currency';
import type { TaxCalculationResult } from '@doctor-tracker/shared/utils/tax';

interface Props {
  taxResult: TaxCalculationResult | null;
}

const COLORS = {
  net: '#10b981',
  irs: '#ef4444',
  ss: '#f59e0b',
};

export function TaxBreakdownChart({ taxResult }: Props) {
  if (!taxResult) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-semibold mb-4">Tax Breakdown</h2>
        <p className="text-sm text-gray-400">No earnings data to calculate taxes.</p>
      </div>
    );
  }

  const data = [
    { name: 'Net Income', value: taxResult.netIncome / 100, color: COLORS.net },
    { name: 'IRS', value: taxResult.irsAmount / 100, color: COLORS.irs },
    { name: 'Social Security', value: taxResult.socialSecurity / 100, color: COLORS.ss },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-semibold mb-4">Tax Breakdown</h2>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
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
        </PieChart>
      </ResponsiveContainer>

      {/* Legend + Details */}
      <div className="space-y-2 mt-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
              <span className="text-gray-600 dark:text-gray-400">{d.name}</span>
            </div>
            <span className="font-medium">{formatEuros(Math.round(d.value * 100))}</span>
          </div>
        ))}
      </div>

      {/* IRS Bracket Breakdown */}
      {taxResult.bracketBreakdown.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs font-medium text-gray-500 mb-2">IRS Brackets</p>
          <div className="space-y-1">
            {taxResult.bracketBreakdown.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-red-400 h-full rounded-full"
                    style={{ width: `${(b.tax / taxResult.irsAmount) * 100}%` }}
                  />
                </div>
                <span className="text-gray-500 w-10 text-right">{b.bracket}</span>
                <span className="text-gray-700 dark:text-gray-300 font-medium w-20 text-right">
                  {formatEuros(b.tax)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
