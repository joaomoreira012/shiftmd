import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShift, useShiftEarnings, useDeleteShift, useWorkplaces, useUpdateShift } from '../../lib/api';
import { formatEuros } from '@doctor-tracker/shared/utils/currency';
import { ShiftFormModal } from './ShiftFormModal';
import type { ShiftStatus } from '@doctor-tracker/shared/types/shift';

interface Props {
  shiftId: string;
  onClose: () => void;
}

const STATUS_TRANSITIONS: Record<ShiftStatus, ShiftStatus[]> = {
  scheduled: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function ShiftDetailModal({ shiftId, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { data: shift, isLoading } = useShift(shiftId);
  const { data: earningsData } = useShiftEarnings(shiftId);
  const { data: workplaces } = useWorkplaces();
  const deleteMutation = useDeleteShift();
  const updateMutation = useUpdateShift();
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const STATUS_LABELS: Record<ShiftStatus, { label: string; color: string }> = {
    scheduled: { label: t('shifts.scheduled'), color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    confirmed: { label: t('shifts.confirmed'), color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    completed: { label: t('shifts.completed'), color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
    cancelled: { label: t('shifts.cancelled'), color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  };

  if (showEdit && shift) {
    return <ShiftFormModal existingShift={shift} onClose={() => { setShowEdit(false); onClose(); }} />;
  }

  const workplace = shift ? workplaces?.find((w) => w.id === shift.workplace_id) : null;

  const handleStatusChange = (newStatus: ShiftStatus) => {
    if (shift) {
      updateMutation.mutate({ id: shift.id, data: { status: newStatus } });
    }
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(shiftId);
    onClose();
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(i18n.language === 'pt' ? 'pt-PT' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const durationHours = shift
    ? ((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3600000).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md m-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !shift ? (
          <div className="p-8 text-center">
            <div className="animate-pulse text-gray-400">{t('common.loading')}</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {workplace && (
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: workplace.color || '#6B7280' }}
                    />
                  )}
                  <h2 className="text-lg font-semibold">
                    {shift.title || workplace?.name || 'Shift'}
                  </h2>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_LABELS[shift.status].color}`}>
                  {STATUS_LABELS[shift.status].label}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Time Info */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('shifts.start')}</span>
                  <span className="font-medium">{formatDateTime(shift.start_time)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('shifts.end')}</span>
                  <span className="font-medium">{formatDateTime(shift.end_time)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('shifts.duration')}</span>
                  <span className="font-medium">{durationHours}h</span>
                </div>
                {workplace && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t('shifts.workplace')}</span>
                    <span className="font-medium">{workplace.name}</span>
                  </div>
                )}
              </div>

              {/* Earnings Breakdown */}
              {earningsData && earningsData.earnings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">{t('shifts.earningsBreakdown')}</h3>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2">
                    {earningsData.earnings.map((seg, i) => {
                      const segStart = new Date(seg.start).toLocaleTimeString(i18n.language === 'pt' ? 'pt-PT' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
                      const segEnd = new Date(seg.end).toLocaleTimeString(i18n.language === 'pt' ? 'pt-PT' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="text-gray-500">{segStart}–{segEnd}</span>
                            {seg.rule_name && (
                              <span className="text-xs text-gray-400 ml-2">({seg.rule_name})</span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-400">{seg.hours.toFixed(1)}h x {formatEuros(seg.rate_cents)}</span>
                            <span className="ml-2 font-medium text-income">{formatEuros(seg.amount_cents)}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 text-sm font-semibold">
                      <span>{t('shifts.total')}</span>
                      <span className="text-income">{formatEuros(earningsData.total_earnings)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {shift.notes && (
                <div>
                  <h3 className="text-sm font-semibold mb-1">{t('shifts.notes')}</h3>
                  <p className="text-sm text-gray-500">{shift.notes}</p>
                </div>
              )}

              {/* Status Transitions */}
              {STATUS_TRANSITIONS[shift.status].length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">{t('shifts.changeStatus')}</h3>
                  <div className="flex gap-2">
                    {STATUS_TRANSITIONS[shift.status].map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        disabled={updateMutation.isPending}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          status === 'cancelled'
                            ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {STATUS_LABELS[status].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg"
                >
                  {t('common.delete')}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    {t('common.close')}
                  </button>
                  <button
                    onClick={() => setShowEdit(true)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
                  >
                    {t('common.edit')}
                  </button>
                </div>
              </div>
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
              <div className="absolute inset-0 bg-white/95 dark:bg-gray-900/95 rounded-xl flex items-center justify-center">
                <div className="p-6 text-center">
                  <h3 className="font-semibold mb-2">{t('shifts.deleteShift')}</h3>
                  <p className="text-sm text-gray-500 mb-4">{t('shifts.cannotUndo')}</p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? t('shifts.deleting') : t('common.delete')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
