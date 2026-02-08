import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMonthlyBreakdown, useWorkplaces } from '../lib/api';
import { formatEuros } from '@doctor-tracker/shared/utils/currency';
import type { WorkplaceEarnings } from '@doctor-tracker/shared/types/finance';
import type { Workplace } from '@doctor-tracker/shared/types/workplace';

const currentYear = new Date().getFullYear();

export function WorkplaceEarningsPage() {
  const { t, i18n } = useTranslation();
  const [year, setYear] = useState(currentYear);
  const { data: breakdown, isLoading } = useMonthlyBreakdown(year);
  const { data: workplaces } = useWorkplaces();

  const monthLocale = i18n.language === 'pt' ? 'pt-PT' : 'en-US';

  // Build per-workplace data: { workplaceId -> { month -> WorkplaceEarnings } }
  const workplaceData = useMemo(() => {
    if (!breakdown || !workplaces) return [];

    const map = new Map<string, { workplace: Workplace; months: Map<number, WorkplaceEarnings> }>();

    breakdown.forEach((monthSummary, monthIndex) => {
      for (const wp of monthSummary.by_workplace || []) {
        if (!map.has(wp.workplace_id)) {
          const fullWp = workplaces.find((w) => w.id === wp.workplace_id);
          map.set(wp.workplace_id, {
            workplace: fullWp || { id: wp.workplace_id, withholding_rate: 0.25, name: wp.workplace_name, color: wp.color } as Workplace,
            months: new Map(),
          });
        }
        map.get(wp.workplace_id)!.months.set(monthIndex, wp);
      }
    });

    // Only include workplaces with at least some earnings
    return Array.from(map.values()).filter((entry) => {
      let total = 0;
      entry.months.forEach((m) => { total += m.gross; });
      return total > 0;
    });
  }, [breakdown, workplaces]);

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Date(year, i, 1).toLocaleDateString(monthLocale, { month: 'short' })
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/finance" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              {t('finance.title')}
            </Link>
            <span className="text-sm text-gray-300 dark:text-gray-600">/</span>
            <h1 className="text-2xl font-bold">{t('finance.workplaceEarnings')}</h1>
          </div>
          <p className="text-sm text-gray-500">{t('finance.workplaceEarningsDesc')}</p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm"
        >
          {[currentYear, currentYear - 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4 animate-pulse" />
              <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : workplaceData.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <p className="text-gray-400">{t('finance.noEarnings', { year })}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {workplaceData.map(({ workplace, months }) => (
            <WorkplaceCard
              key={workplace.id}
              workplace={workplace}
              months={months}
              monthNames={monthNames}
              year={year}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkplaceCard({
  workplace,
  months,
  monthNames,
  year,
}: {
  workplace: Workplace;
  months: Map<number, WorkplaceEarnings>;
  monthNames: string[];
  year: number;
}) {
  const { t, i18n } = useTranslation();
  const euroLocale = i18n.language === 'pt' ? 'pt-PT' : 'en-US';
  const rate = workplace.withholding_rate;
  const isMonthly = workplace.pay_model === 'monthly';
  const showConsult = workplace.has_consultation_pay;
  const showVisits = workplace.has_outside_visit_pay;

  // For monthly workplaces, the gross per month is the fixed salary, not the sum of shift earnings
  const monthlyRate = isMonthly ? workplace.base_rate_cents : 0;

  // Compute totals
  let totalGross = 0;
  let totalShifts = 0;
  let totalHours = 0;
  let totalPatients = 0;
  let totalVisits = 0;
  months.forEach((m) => {
    totalGross += isMonthly ? monthlyRate : m.gross;
    totalShifts += m.shift_count;
    totalHours += m.hours;
    totalPatients += m.patients_seen;
    totalVisits += m.outside_visits;
  });
  const totalNet = Math.round(totalGross * (1 - rate));
  const dash = <span className="text-gray-300 dark:text-gray-600">-</span>;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: workplace.color || '#6B7280' }}
        />
        <h2 className="text-lg font-semibold">{workplace.name}</h2>
        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
          {workplace.pay_model === 'monthly' ? t('workplaces.perMonthShort') : workplace.pay_model === 'per_turn' ? t('workplaces.perTurnShort') : t('workplaces.perHourShort')}
        </span>
        <span className="text-xs text-gray-400 ml-auto">
          {t('finance.withholding')}: {(rate * 100).toFixed(1)}%
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="text-left py-2 text-gray-500 font-medium">{t('finance.month')}</th>
              <th className="text-right py-2 text-gray-500 font-medium">{t('finance.shifts')}</th>
              <th className="text-right py-2 text-gray-500 font-medium">{t('finance.hours')}</th>
              {showConsult && <th className="text-right py-2 text-gray-500 font-medium">{t('finance.consultations')}</th>}
              {showVisits && <th className="text-right py-2 text-gray-500 font-medium">{t('finance.outsideVisits')}</th>}
              <th className="text-right py-2 text-gray-500 font-medium">{t('finance.gross')}</th>
              <th className="text-right py-2 text-gray-500 font-medium">{t('finance.net')}</th>
              <th className="text-right py-2 text-gray-500 font-medium hidden md:table-cell">{t('finance.grossPerHour')}</th>
              <th className="text-right py-2 text-gray-500 font-medium hidden md:table-cell">{t('finance.netPerHour')}</th>
              <th className="text-right py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {monthNames.map((name, i) => {
              const m = months.get(i);
              if (!m || m.gross === 0) {
                return (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50 opacity-40">
                    <td className="py-2 font-medium capitalize">{name}</td>
                    <td className="text-right py-2">{dash}</td>
                    <td className="text-right py-2">{dash}</td>
                    {showConsult && <td className="text-right py-2">{dash}</td>}
                    {showVisits && <td className="text-right py-2">{dash}</td>}
                    <td className="text-right py-2">{dash}</td>
                    <td className="text-right py-2">{dash}</td>
                    <td className="text-right py-2 hidden md:table-cell">{dash}</td>
                    <td className="text-right py-2 hidden md:table-cell">{dash}</td>
                    <td></td>
                  </tr>
                );
              }
              const gross = isMonthly ? monthlyRate : m.gross;
              const net = Math.round(gross * (1 - rate));
              const grossPerHour = m.hours > 0 ? Math.round(gross / m.hours) : 0;
              const netPerHour = m.hours > 0 ? Math.round(net / m.hours) : 0;
              return (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50">
                  <td className="py-2 font-medium capitalize">{name}</td>
                  <td className="text-right py-2">{m.shift_count}</td>
                  <td className="text-right py-2">{m.hours.toFixed(1)}</td>
                  {showConsult && <td className="text-right py-2">{m.patients_seen || dash}</td>}
                  {showVisits && <td className="text-right py-2">{m.outside_visits || dash}</td>}
                  <td className="text-right py-2 font-medium">{formatEuros(gross, euroLocale)}</td>
                  <td className="text-right py-2 text-emerald-600 dark:text-emerald-400">{formatEuros(net, euroLocale)}</td>
                  <td className="text-right py-2 text-gray-500 hidden md:table-cell">{formatEuros(grossPerHour, euroLocale)}</td>
                  <td className="text-right py-2 text-gray-500 hidden md:table-cell">{formatEuros(netPerHour, euroLocale)}</td>
                  <td className="text-right py-2 pl-2">
                    <Link
                      to={`/finance?invoice=new&workplace=${workplace.id}&month=${i + 1}&year=${year}`}
                      className="text-xs text-primary-500 hover:text-primary-600 whitespace-nowrap"
                    >
                      {t('finance.newInvoice')}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-700 font-semibold bg-gray-50 dark:bg-gray-800/50">
              <td className="py-2">{t('finance.total')}</td>
              <td className="text-right py-2">{totalShifts}</td>
              <td className="text-right py-2">{totalHours.toFixed(1)}</td>
              {showConsult && <td className="text-right py-2">{totalPatients}</td>}
              {showVisits && <td className="text-right py-2">{totalVisits}</td>}
              <td className="text-right py-2">{formatEuros(totalGross, euroLocale)}</td>
              <td className="text-right py-2 text-emerald-600 dark:text-emerald-400">{formatEuros(totalNet, euroLocale)}</td>
              <td className="text-right py-2 text-gray-500 hidden md:table-cell">
                {totalHours > 0 ? formatEuros(Math.round(totalGross / totalHours), euroLocale) : '-'}
              </td>
              <td className="text-right py-2 text-gray-500 hidden md:table-cell">
                {totalHours > 0 ? formatEuros(Math.round(totalNet / totalHours), euroLocale) : '-'}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
