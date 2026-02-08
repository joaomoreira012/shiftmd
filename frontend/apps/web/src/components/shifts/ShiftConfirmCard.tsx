import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatEuros } from '@doctor-tracker/shared/utils/currency';
import type { Shift } from '@doctor-tracker/shared/types/shift';
import type { Workplace } from '@doctor-tracker/shared/types/workplace';

interface ShiftConfirmCardProps {
  shift: Shift;
  workplace: Workplace | undefined;
  onConfirm: (data: { patients_seen?: number; outside_visits?: number }) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function ShiftConfirmCard({ shift, workplace, onConfirm, onCancel, isPending }: ShiftConfirmCardProps) {
  const { t, i18n } = useTranslation();
  const [patientsSeen, setPatientsSeen] = useState<string>(
    shift.patients_seen != null ? String(shift.patients_seen) : ''
  );
  const [outsideVisits, setOutsideVisits] = useState<string>(
    shift.outside_visits != null ? String(shift.outside_visits) : ''
  );

  const needsConsultation = workplace?.has_consultation_pay ?? false;
  const needsOutsideVisits = workplace?.has_outside_visit_pay ?? false;

  const locale = i18n.language === 'pt' ? 'pt-PT' : 'en-GB';
  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  const dateStr = start.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const startStr = start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const endStr = end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const handleConfirm = () => {
    if (needsConsultation && patientsSeen === '') {
      toast.error(t('dashboard.fillRequired'));
      return;
    }
    if (needsOutsideVisits && outsideVisits === '') {
      toast.error(t('dashboard.fillRequired'));
      return;
    }
    const data: { patients_seen?: number; outside_visits?: number } = {};
    if (needsConsultation) data.patients_seen = Number(patientsSeen);
    if (needsOutsideVisits) data.outside_visits = Number(outsideVisits);
    onConfirm(data);
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
      {/* Top row: workplace info + earnings */}
      <div className="flex items-center gap-3">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: workplace?.color || '#6B7280' }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{workplace?.name || 'Shift'}</p>
          <p className="text-xs text-gray-500">{dateStr}, {startStr}–{endStr}</p>
        </div>
        {shift.total_earnings != null && (
          <span className="text-sm font-medium text-income flex-shrink-0">{formatEuros(shift.total_earnings)}</span>
        )}
      </div>

      {/* Bottom row: optional inputs + actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {needsConsultation && (
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            {t('shifts.patientsSeen')}<span className="text-red-500">*</span>
            <input
              type="number"
              min="0"
              placeholder="0"
              aria-required="true"
              value={patientsSeen}
              onChange={(e) => setPatientsSeen(e.target.value)}
              className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs"
            />
          </label>
        )}
        {needsOutsideVisits && (
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            {t('shifts.outsideVisits')}<span className="text-red-500">*</span>
            <input
              type="number"
              min="0"
              placeholder="0"
              aria-required="true"
              value={outsideVisits}
              onChange={(e) => setOutsideVisits(e.target.value)}
              className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs"
            />
          </label>
        )}
        <div className="flex items-center gap-1.5 w-full sm:w-auto sm:ml-auto">
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('common.saving')}
              </>
            ) : (
              t('dashboard.completeShift')
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors disabled:opacity-50"
            aria-label={t('dashboard.cancelShift')}
            title={t('dashboard.cancelShift')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
