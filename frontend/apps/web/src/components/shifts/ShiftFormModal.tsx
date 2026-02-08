import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCreateShift, useUpdateShift, useWorkplaces } from '../../lib/api';
import type { Shift } from '@doctor-tracker/shared/types/shift';

function toLocalDatetime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultDayTimes(baseDate: Date) {
  const start = new Date(baseDate);
  start.setHours(8, 0, 0, 0);
  const end = new Date(baseDate);
  end.setHours(20, 0, 0, 0);
  return { start, end };
}

function defaultNightTimes(baseDate: Date) {
  const start = new Date(baseDate);
  start.setHours(20, 0, 0, 0);
  const end = new Date(baseDate);
  end.setDate(end.getDate() + 1);
  end.setHours(8, 0, 0, 0);
  return { start, end };
}

interface Props {
  defaultStart?: Date;
  defaultEnd?: Date;
  existingShift?: Shift;
  onClose: () => void;
}

export function ShiftFormModal({ defaultStart, defaultEnd, existingShift, onClose }: Props) {
  const { t } = useTranslation();
  const isEditing = !!existingShift;
  const { data: workplaces } = useWorkplaces();
  const createMutation = useCreateShift();
  const updateMutation = useUpdateShift();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [workplaceId, setWorkplaceId] = useState(
    existingShift?.workplace_id || workplaces?.[0]?.id || ''
  );
  const initialDay = defaultStart
    ? defaultDayTimes(defaultStart)
    : defaultDayTimes(new Date());

  const [startTime, setStartTime] = useState(
    existingShift
      ? toLocalDatetime(new Date(existingShift.start_time))
      : defaultStart
        ? toLocalDatetime(defaultStart)
        : toLocalDatetime(initialDay.start)
  );
  const [endTime, setEndTime] = useState(
    existingShift
      ? toLocalDatetime(new Date(existingShift.end_time))
      : defaultEnd
        ? toLocalDatetime(defaultEnd)
        : toLocalDatetime(initialDay.end)
  );

  const applyPreset = (preset: 'day' | 'night') => {
    const baseDate = startTime ? new Date(startTime) : new Date();
    const times = preset === 'day' ? defaultDayTimes(baseDate) : defaultNightTimes(baseDate);
    setStartTime(toLocalDatetime(times.start));
    setEndTime(toLocalDatetime(times.end));
  };
  const [patientsSeen, setPatientsSeen] = useState<string>(
    existingShift?.patients_seen != null ? String(existingShift.patients_seen) : ''
  );
  const [outsideVisits, setOutsideVisits] = useState<string>(
    existingShift?.outside_visits != null ? String(existingShift.outside_visits) : ''
  );

  const selectedWorkplace = workplaces?.find((w) => w.id === workplaceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workplaceId) {
      toast.error(t('shifts.selectWorkplace'));
      return;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (endDate <= startDate) {
      toast.error(t('shifts.endAfterStart'));
      return;
    }

    try {
      const patientsSeenNum = patientsSeen ? parseInt(patientsSeen, 10) : undefined;
      const outsideVisitsNum = outsideVisits ? parseInt(outsideVisits, 10) : undefined;

      if (isEditing) {
        await updateMutation.mutateAsync({
          id: existingShift.id,
          data: {
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            patients_seen: patientsSeenNum,
            outside_visits: outsideVisitsNum,
          },
        });
        toast.success(t('shifts.shiftUpdated'));
      } else {
        await createMutation.mutateAsync({
          workplace_id: workplaceId,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          patients_seen: patientsSeenNum,
          outside_visits: outsideVisitsNum,
        });
        toast.success(t('shifts.shiftCreated'));
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save shift');
    }
  };

  // Duration calculation
  const durationHours = (() => {
    if (!startTime || !endTime) return null;
    const diff = new Date(endTime).getTime() - new Date(startTime).getTime();
    if (diff <= 0) return null;
    return (diff / 3600000).toFixed(1);
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">{isEditing ? t('shifts.editShift') : t('shifts.newShift')}</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Workplace */}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('shifts.workplace') + ' *'}</label>
              <div className="space-y-1.5">
                {workplaces?.filter((w) => w.is_active).map((wp) => (
                  <label
                    key={wp.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      workplaceId === wp.id
                        ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="workplace"
                      value={wp.id}
                      checked={workplaceId === wp.id}
                      onChange={() => setWorkplaceId(wp.id)}
                      className="sr-only"
                    />
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: wp.color || '#6B7280' }}
                    />
                    <span className="text-sm font-medium">{wp.name}</span>
                  </label>
                ))}
              </div>
              {(!workplaces || workplaces.filter((w) => w.is_active).length === 0) && (
                <p className="text-sm text-gray-400">{t('shifts.createFirst')}</p>
              )}
            </div>
          )}

          {/* Day/Night preset */}
          {!isEditing && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => applyPreset('day')}
                className="flex-1 py-2 px-3 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {t('shifts.dayShift')} (08:00–20:00)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('night')}
                className="flex-1 py-2 px-3 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {t('shifts.nightShift')} (20:00–08:00)
              </button>
            </div>
          )}

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('shifts.start') + ' *'}</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('shifts.end') + ' *'}</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {durationHours && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">{t('shifts.duration') + ':'}</span>
              <span className="font-medium">{durationHours}h</span>
              {selectedWorkplace && (
                <span className="text-gray-400">at {selectedWorkplace.name}</span>
              )}
            </div>
          )}

          {/* Patients Seen (only when workplace has consultation pay) */}
          {selectedWorkplace?.has_consultation_pay && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('shifts.patientsSeen')}</label>
              <input
                type="number"
                min="0"
                step="1"
                value={patientsSeen}
                onChange={(e) => setPatientsSeen(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          )}

          {/* Outside Visits (only when workplace has outside visit pay) */}
          {selectedWorkplace?.has_outside_visit_pay && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('shifts.outsideVisits')}</label>
              <input
                type="number"
                min="0"
                step="1"
                value={outsideVisits}
                onChange={(e) => setOutsideVisits(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? t('common.saving') : isEditing ? t('common.saveChanges') : t('shifts.createShift')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
