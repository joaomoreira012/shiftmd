import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useYearlySummary, useProjections, useWorkplaces } from '../lib/api';
import { formatEuros } from '@doctor-tracker/shared/utils/currency';
import { calculatePortugueseTax } from '@doctor-tracker/shared/utils/tax';
import { EarningsTrendChart } from '../components/finance/EarningsTrendChart';
import { WorkplaceBreakdownChart } from '../components/finance/WorkplaceBreakdownChart';
import { TaxBreakdownChart } from '../components/finance/TaxBreakdownChart';
import { InvoicesSection } from '../components/finance/InvoicesSection';

const currentYear = new Date().getFullYear();

export function FinancePage() {
  const { t, i18n } = useTranslation();
  const [year, setYear] = useState(currentYear);
  const { data: summary, isLoading } = useYearlySummary(year);
  const { data: projections } = useProjections(year);
  const { data: workplaces } = useWorkplaces();

  // Client-side tax calculation: project YTD to annual for current year
  const taxResult = useMemo(() => {
    const gross = summary?.gross_earnings ?? 0;
    if (gross === 0) return null;
    let annualGross = gross;
    if (year === currentYear) {
      const monthsElapsed = new Date().getMonth() + 1;
      annualGross = Math.round(gross * 12 / monthsElapsed);
    }
    return calculatePortugueseTax({ grossAnnualIncomeCents: annualGross, year });
  }, [summary?.gross_earnings, year]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('finance.title')}</h1>
        <div className="flex items-center gap-3">
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title={t('finance.totalGross')}
          value={summary ? formatEuros(summary.gross_earnings) : '---'}
          subtitle={summary ? t('finance.shiftsCount', { count: summary.shift_count }) : ''}
          color="text-income"
          loading={isLoading}
        />
        <KpiCard
          title={t('finance.estimatedNet')}
          value={taxResult ? formatEuros(taxResult.netIncome) : '---'}
          subtitle={taxResult ? `${formatEuros(taxResult.monthlyNet)}${t('finance.perMonth')}` : ''}
          loading={isLoading}
        />
        <KpiCard
          title={t('dashboard.irsEstimate')}
          value={taxResult ? formatEuros(taxResult.irsAmount) : '---'}
          subtitle={taxResult ? `${(taxResult.irsEffectiveRate * 100).toFixed(1)}% ${t('finance.effective')}` : ''}
          color="text-tax"
          loading={isLoading}
        />
        <KpiCard
          title={t('dashboard.socialSecurity')}
          value={taxResult ? formatEuros(taxResult.socialSecurity) : '---'}
          subtitle={taxResult ? `${formatEuros(Math.round(taxResult.socialSecurity / 4))}${t('finance.perQuarter')}` : ''}
          color="text-tax"
          loading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <EarningsTrendChart projections={projections || []} />
        <WorkplaceBreakdownChart
          workplaceEarnings={summary?.by_workplace || []}
          workplaces={workplaces || []}
        />
      </div>

      {/* Tax Breakdown + Projections Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TaxBreakdownChart taxResult={taxResult} />
        <ProjectionsTable projections={projections || []} />
      </div>

      {/* Invoices Section */}
      <InvoicesSection year={year} workplaces={workplaces || []} />
    </div>
  );
}

function KpiCard({ title, value, subtitle, color, loading }: {
  title: string;
  value: string;
  subtitle: string;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      {loading ? (
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
      ) : (
        <p className={`text-2xl font-bold ${color || ''}`}>{value}</p>
      )}
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

function ProjectionsTable({ projections }: { projections: Array<{ month: string; projected_gross: number; actual_gross: number; difference: number; is_actual: boolean }> }) {
  const { t, i18n } = useTranslation();
  const monthLocale = i18n.language === 'pt' ? 'pt' : 'en';

  if (projections.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-semibold mb-4">{t('finance.monthlyBreakdown')}</h2>
        <p className="text-sm text-gray-400">{t('finance.noProjections')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-semibold mb-4">{t('finance.monthlyBreakdown')}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="text-left py-2 text-gray-500 font-medium">{t('finance.month')}</th>
              <th className="text-right py-2 text-gray-500 font-medium">{t('finance.actual')}</th>
              <th className="text-right py-2 text-gray-500 font-medium">{t('finance.projected')}</th>
              <th className="text-right py-2 text-gray-500 font-medium">{t('finance.diff')}</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((p) => {
              const monthLabel = new Date(p.month + '-01').toLocaleDateString(monthLocale, { month: 'short' });
              return (
                <tr key={p.month} className="border-b border-gray-100 dark:border-gray-800/50">
                  <td className="py-2 font-medium">
                    {monthLabel}
                    {p.is_actual && <span className="ml-1.5 text-xs text-emerald-500">{t('finance.actualLabel')}</span>}
                  </td>
                  <td className="text-right py-2">
                    {p.actual_gross > 0 ? formatEuros(p.actual_gross) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="text-right py-2 text-gray-400">
                    {formatEuros(p.projected_gross)}
                  </td>
                  <td className={`text-right py-2 ${p.difference >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {p.difference !== 0 ? (p.difference > 0 ? '+' : '') + formatEuros(p.difference) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
