import { usePricingRules } from '../../lib/api';
import { DAYS_OF_WEEK, WEEKDAYS, WEEKEND } from '@doctor-tracker/shared/constants/pay-models';
import { formatEuros } from '@doctor-tracker/shared/utils/currency';
import type { PricingRule, DayOfWeek } from '@doctor-tracker/shared/types/workplace';

interface Props {
  workplaceId: string;
  baseRateCents: number;
  workplaceColor?: string;
}

// Generate distinct colors for rules
const RULE_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function isRuleActiveAt(rule: PricingRule, day: DayOfWeek, hour: number): boolean {
  // Check day
  if (rule.days_of_week && rule.days_of_week.length > 0 && !rule.days_of_week.includes(day)) {
    return false;
  }

  // Check time
  if (!rule.time_start || !rule.time_end) return true;

  const startMins = timeToMinutes(rule.time_start);
  const endMins = timeToMinutes(rule.time_end);
  const currentMins = hour * 60;

  // Overnight rule (e.g., 20:00 - 08:00)
  if (startMins > endMins) {
    return currentMins >= startMins || currentMins < endMins;
  }
  // Normal rule (e.g., 08:00 - 20:00)
  return currentMins >= startMins && currentMins < endMins;
}

function resolveRuleForSlot(rules: PricingRule[], day: DayOfWeek, hour: number): PricingRule | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (rule.is_active && isRuleActiveAt(rule, day, hour)) {
      return rule;
    }
  }
  return null;
}

function computeCoverage(rules: PricingRule[]): { covered: number; total: number } {
  let covered = 0;
  const total = 7 * 24;
  for (const day of DAYS_OF_WEEK) {
    for (const hour of HOURS) {
      if (resolveRuleForSlot(rules, day.value, hour)) {
        covered++;
      }
    }
  }
  return { covered, total };
}

export function PricingMatrixPreview({ workplaceId, baseRateCents, workplaceColor: _workplaceColor }: Props) {
  const { data: rules } = usePricingRules(workplaceId);

  if (!rules || rules.length === 0) return null;

  const ruleColorMap = new Map<string, typeof RULE_COLORS[number]>();
  rules.sort((a, b) => a.priority - b.priority).forEach((rule, i) => {
    ruleColorMap.set(rule.id, RULE_COLORS[i % RULE_COLORS.length]);
  });

  const coverage = computeCoverage(rules);
  const coveragePct = Math.round((coverage.covered / coverage.total) * 100);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Coverage Preview</h2>
          <div className="flex items-center gap-2">
            <div className={`text-sm font-medium ${coveragePct === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {coveragePct}% covered
            </div>
            {coveragePct < 100 && (
              <span className="text-xs text-amber-500">
                ({coverage.total - coverage.covered} hours use base rate)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {rules.sort((a, b) => a.priority - b.priority).map((rule) => {
            const colors = ruleColorMap.get(rule.id)!;
            const rate = rule.rate_cents != null
              ? formatEuros(rule.rate_cents)
              : `${rule.rate_multiplier}x`;
            return (
              <div key={rule.id} className={`flex items-center gap-2 px-2.5 py-1 rounded-md ${colors.bg} ${colors.border} border`}>
                <span className={`text-xs font-medium ${colors.text}`}>{rule.name}</span>
                <span className={`text-xs ${colors.text} opacity-75`}>{rate}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500">Base</span>
            <span className="text-xs text-gray-400">{formatEuros(baseRateCents)}</span>
          </div>
        </div>

        {/* Matrix Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-12 text-xs text-gray-400 font-normal text-right pr-2 pb-1" />
                {DAYS_OF_WEEK.map((day) => (
                  <th
                    key={day.value}
                    className={`text-xs font-medium pb-1 text-center ${
                      WEEKEND.includes(day.value) ? 'text-amber-500' : 'text-gray-500'
                    }`}
                  >
                    {day.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => (
                <tr key={hour}>
                  <td className="text-xs text-gray-400 text-right pr-2 py-0 align-middle font-mono">
                    {hour.toString().padStart(2, '0')}
                  </td>
                  {DAYS_OF_WEEK.map((day) => {
                    const matchedRule = resolveRuleForSlot(rules, day.value, hour);
                    const colors = matchedRule ? ruleColorMap.get(matchedRule.id) : null;
                    return (
                      <td
                        key={day.value}
                        className={`h-5 border border-gray-100 dark:border-gray-800 ${
                          colors ? colors.bg : 'bg-gray-50 dark:bg-gray-800/30'
                        }`}
                        title={
                          matchedRule
                            ? `${day.short} ${hour}:00 - ${matchedRule.name}`
                            : `${day.short} ${hour}:00 - Base rate`
                        }
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
