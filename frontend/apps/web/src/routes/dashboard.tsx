import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useShiftsInRange, useUpdateShift, useWorkplaces, useProjections } from '../lib/api';
import { formatEuros } from '@doctor-tracker/shared/utils/currency';
import { calculatePortugueseTax } from '@doctor-tracker/shared/utils/tax';
import { ShiftFormModal } from '../components/shifts/ShiftFormModal';
import { ShiftConfirmCard } from '../components/shifts/ShiftConfirmCard';
import { Skeleton } from '../components/ui/Skeleton';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: workplaces, isLoading: wpLoading } = useWorkplaces();
  const [showNewShift, setShowNewShift] = useState(false);
  const updateShift = useUpdateShift();
  const currentYear = new Date().getFullYear();
  const { data: projections } = useProjections(currentYear);

  // Single query covering 90 days ago -> 14 days ahead (memoized to avoid infinite re-fetch loop)
  const [rangeStartISO, rangeEndISO, nowISO] = useMemo(() => {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 3600000);
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 3600000);
    return [ninetyDaysAgo.toISOString(), twoWeeksLater.toISOString(), now.toISOString()];
  }, []);
  const { data: allShiftsRaw, isLoading: shiftsLoading } = useShiftsInRange(rangeStartISO, rangeEndISO);

  const isLoading = wpLoading || shiftsLoading;

  // Derive past/upcoming splits from the single query
  const pastShifts = useMemo(() =>
    allShiftsRaw?.filter((s) => new Date(s.start_time).getTime() < new Date(nowISO).getTime()),
    [allShiftsRaw, nowISO],
  );
  const upcomingShifts = useMemo(() =>
    allShiftsRaw?.filter((s) => new Date(s.start_time).getTime() >= new Date(nowISO).getTime() && s.status !== 'cancelled'),
    [allShiftsRaw, nowISO],
  );

  // Compute hours this week and this month from all non-cancelled shifts
  const { hoursThisWeek, shiftsThisWeek, hoursThisMonth, shiftsThisMonth } = useMemo(() => {
    const allShifts = (allShiftsRaw ?? []).filter((s) => s.status !== 'cancelled');

    const now = new Date();
    // Start of current week (Monday)
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Start/end of current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Compute overlapping hours between a shift [sStart, sEnd] and a period [pStart, pEnd]
    const overlapHours = (sStart: number, sEnd: number, pStart: number, pEnd: number) => {
      const overlapStart = Math.max(sStart, pStart);
      const overlapEnd = Math.min(sEnd, pEnd);
      return overlapEnd > overlapStart ? (overlapEnd - overlapStart) / 3600000 : 0;
    };

    const wStart = weekStart.getTime(), wEnd = weekEnd.getTime();
    const mStart = monthStart.getTime(), mEnd = monthEnd.getTime();

    let hWeek = 0, sWeek = 0, hMonth = 0, sMonth = 0;
    for (const s of allShifts) {
      const start = new Date(s.start_time).getTime();
      const end = new Date(s.end_time).getTime();
      const weekHours = overlapHours(start, end, wStart, wEnd);
      if (weekHours > 0) {
        hWeek += weekHours;
        sWeek++;
      }
      const monthHours = overlapHours(start, end, mStart, mEnd);
      if (monthHours > 0) {
        hMonth += monthHours;
        sMonth++;
      }
    }
    return { hoursThisWeek: hWeek, shiftsThisWeek: sWeek, hoursThisMonth: hMonth, shiftsThisMonth: sMonth };
  }, [allShiftsRaw]);

  // This month's gross from projections API (server-computed earnings)
  const grossThisMonth = useMemo(() => {
    if (!projections) return 0;
    const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const entry = projections.find((p) => p.month === currentMonth);
    return entry?.actual_gross ?? 0;
  }, [projections, currentYear]);

  // Estimate net from gross using projected annual tax rates
  const netThisMonth = useMemo(() => {
    if (grossThisMonth === 0) return 0;
    const annualGross = grossThisMonth * 12;
    const tax = calculatePortugueseTax({ grossAnnualIncomeCents: annualGross });
    const totalDeductions = tax.irsAmount + tax.socialSecurity;
    const deductionRate = totalDeductions / tax.grossIncome;
    return Math.round(grossThisMonth * (1 - deductionRate));
  }, [grossThisMonth]);

  const formatHours = (h: number) => {
    if (h === 0) return '0h';
    const whole = Math.floor(h);
    const mins = Math.round((h - whole) * 60);
    return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`;
  };

  // Past shifts that need confirmation
  const unconfirmedShifts = pastShifts
    ?.filter((s) => s.status !== 'confirmed' && s.status !== 'completed' && s.status !== 'cancelled')
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  // Only non-cancelled, sorted by start time
  const sortedUpcoming = upcomingShifts
    ?.filter((s) => s.status !== 'cancelled')
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 8);

  const formatShiftTime = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const locale = i18n.language === 'pt' ? 'pt-PT' : 'en-GB';
    const dateStr = s.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    const startStr = s.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const endStr = e.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${dateStr}, ${startStr}–${endStr}`;
  };

  const handleConfirmShift = (shiftId: string, data: { patients_seen?: number; outside_visits?: number }) => {
    updateShift.mutate({
      id: shiftId,
      data: { status: 'completed', ...data },
    }, {
      onSuccess: () => toast.success(t('shifts.shiftUpdated')),
    });
  };

  const handleCancelShift = (shiftId: string) => {
    if (!window.confirm(t('dashboard.cancelShiftConfirm'))) return;
    updateShift.mutate({
      id: shiftId,
      data: { status: 'cancelled' },
    }, {
      onSuccess: () => toast.success(t('shifts.shiftUpdated')),
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('dashboard.title')}</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <Skeleton className="h-4 w-28 mb-3" />
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </>
        ) : (
          <>
            <StatCard title={t('dashboard.thisMonthGross')} value={formatEuros(grossThisMonth)} subtitle={t('dashboard.shiftsCount', { count: shiftsThisMonth })} />
            <StatCard title={t('dashboard.thisMonthNet')} value={formatEuros(netThisMonth)} subtitle={t('dashboard.shiftsCount', { count: shiftsThisMonth })} />
            <StatCard title={t('dashboard.hoursThisWeek')} value={formatHours(hoursThisWeek)} subtitle={t('dashboard.shiftsCount', { count: shiftsThisWeek })} />
            <StatCard title={t('dashboard.hoursThisMonth')} value={formatHours(hoursThisMonth)} subtitle={t('dashboard.shiftsCount', { count: shiftsThisMonth })} />
          </>
        )}
      </div>

      {/* Shifts to Confirm */}
      {!shiftsLoading && unconfirmedShifts && unconfirmedShifts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{t('dashboard.shiftsToConfirm')} ({unconfirmedShifts.length})</h2>
          <div className="space-y-2">
            {unconfirmedShifts.map((shift) => {
              const wp = workplaces?.find((w) => w.id === shift.workplace_id);
              return (
                <ShiftConfirmCard
                  key={shift.id}
                  shift={shift}
                  workplace={wp}
                  onConfirm={(data) => handleConfirmShift(shift.id, data)}
                  onCancel={() => handleCancelShift(shift.id)}
                  isPending={updateShift.isPending}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Shifts */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('dashboard.upcomingShifts')}</h2>
            <button
              onClick={() => navigate('/calendar')}
              className="text-xs text-primary-600 hover:underline"
            >
              {t('dashboard.viewAll')}
            </button>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="w-2.5 h-2.5 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : sortedUpcoming && sortedUpcoming.length > 0 ? (
            <div className="space-y-2">
              {sortedUpcoming.map((shift) => {
                const wp = workplaces?.find((w) => w.id === shift.workplace_id);
                return (
                  <div key={shift.id} className="flex items-center gap-3 py-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: wp?.color || '#6B7280' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{wp?.name || 'Shift'}</p>
                      <p className="text-xs text-gray-500">{formatShiftTime(shift.start_time, shift.end_time)}</p>
                    </div>
                    {shift.total_earnings != null && (
                      <span className="text-sm font-medium text-income">{formatEuros(shift.total_earnings)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">{t('dashboard.noUpcoming')}</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">{t('dashboard.quickActions')}</h2>
          <div className="space-y-3">
            <button
              onClick={() => setShowNewShift(true)}
              className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              {t('dashboard.newShift')}
            </button>
            <button
              onClick={() => navigate('/workplaces')}
              className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              {t('dashboard.newWorkplace')}
            </button>
            <button
              onClick={() => navigate('/finance')}
              className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              {t('dashboard.viewFinance')}
            </button>
          </div>
        </div>
      </div>

      {showNewShift && <ShiftFormModal onClose={() => setShowNewShift(false)} />}
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}
