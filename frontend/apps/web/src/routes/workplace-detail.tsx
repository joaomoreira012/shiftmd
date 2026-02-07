import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useWorkplace, useArchiveWorkplace } from '../lib/api';
import { WorkplaceFormModal } from '../components/workplaces/WorkplaceFormModal';
import { PricingRulesEditor } from '../components/workplaces/PricingRulesEditor';
import { PricingMatrixPreview } from '../components/workplaces/PricingMatrixPreview';
import { formatEuros } from '@doctor-tracker/shared/utils/currency';
import { PAY_MODEL_OPTIONS } from '@doctor-tracker/shared/constants/pay-models';

export function WorkplaceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: workplace, isLoading } = useWorkplace(id!);
  const archiveMutation = useArchiveWorkplace();
  const [showEdit, setShowEdit] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (!workplace) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('workplaces.notFound')}</p>
        <button onClick={() => navigate('/workplaces')} className="text-primary-600 mt-2 text-sm hover:underline">
          {t('workplaces.backToWorkplaces')}
        </button>
      </div>
    );
  }

  const payModelInfo = PAY_MODEL_OPTIONS.find((o) => o.value === workplace.pay_model);

  const handleArchive = async () => {
    await archiveMutation.mutateAsync(workplace.id);
    navigate('/workplaces');
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/workplaces')}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          &larr;
        </button>
        <span
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: workplace.color || '#6B7280' }}
        />
        <h1 className="text-2xl font-bold flex-1">{workplace.name}</h1>
        <button
          onClick={() => setShowEdit(true)}
          className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {t('common.edit')}
        </button>
        <button
          onClick={() => setShowArchiveConfirm(true)}
          className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          {t('workplaces.archive')}
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <p className="text-xs text-gray-500 mb-1">{t('workplaces.payModel')}</p>
          <p className="text-sm font-semibold">{payModelInfo?.label}</p>
          {workplace.has_consultation_pay && (
            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
              {t('workplaces.consultationPayEnabled')}
            </span>
          )}
          <p className="text-xs text-gray-400 mt-1">{payModelInfo?.description}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <p className="text-xs text-gray-500 mb-1">{t('workplaces.baseRate')}</p>
          <p className="text-lg font-bold text-income">{formatEuros(workplace.base_rate_cents)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {workplace.pay_model === 'hourly' && t('workplaces.perHourShort')}
            {workplace.pay_model === 'per_turn' && t('workplaces.perTurnShort')}
            {workplace.pay_model === 'monthly' && t('workplaces.perMonthShort')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <p className="text-xs text-gray-500 mb-1">{t('workplaces.details')}</p>
          {workplace.address && <p className="text-sm">{workplace.address}</p>}
          {workplace.contact_name && (
            <p className="text-xs text-gray-400 mt-1">{workplace.contact_name} {workplace.contact_phone && `- ${workplace.contact_phone}`}</p>
          )}
          {!workplace.address && !workplace.contact_name && (
            <p className="text-xs text-gray-400">{t('workplaces.noDetails')}</p>
          )}
        </div>
      </div>

      {/* Pricing Rules Editor */}
      {(workplace.pay_model === 'hourly' || workplace.has_consultation_pay) && (
        <div className="space-y-6">
          <PricingRulesEditor workplaceId={workplace.id} baseRateCents={workplace.base_rate_cents} hasConsultationPay={workplace.has_consultation_pay} />
          {workplace.pay_model === 'hourly' && (
            <PricingMatrixPreview workplaceId={workplace.id} baseRateCents={workplace.base_rate_cents} workplaceColor={workplace.color} />
          )}
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <WorkplaceFormModal
          workplace={workplace}
          onClose={() => setShowEdit(false)}
          onSuccess={() => setShowEdit(false)}
        />
      )}

      {/* Archive confirmation */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowArchiveConfirm(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">{t('workplaces.archiveWorkplace')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {t('workplaces.archiveConfirm', { name: workplace.name })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleArchive}
                disabled={archiveMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {archiveMutation.isPending ? t('workplaces.archiving') : t('workplaces.archive')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
