import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useWorkplaces } from '../lib/api';
import { WorkplaceFormModal } from '../components/workplaces/WorkplaceFormModal';
import { formatEuros } from '@doctor-tracker/shared/utils/currency';
import { PAY_MODEL_OPTIONS } from '@doctor-tracker/shared/constants/pay-models';
import type { Workplace } from '@doctor-tracker/shared/types/workplace';

function payModelLabel(model: Workplace['pay_model']) {
  return PAY_MODEL_OPTIONS.find((o) => o.value === model)?.label ?? model;
}

function rateLabel(workplace: Workplace) {
  const formatted = formatEuros(workplace.base_rate_cents);
  switch (workplace.pay_model) {
    case 'hourly':
      return `${formatted}/hr`;
    case 'per_turn':
      return `${formatted}/turn`;
    case 'monthly':
      return `${formatted}/mo`;
  }
}

export function WorkplacesPage() {
  const { t } = useTranslation();
  const { data: workplaces, isLoading } = useWorkplaces();
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('workplaces.title')}</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          {t('workplaces.addWorkplace')}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 animate-pulse">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : workplaces && workplaces.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workplaces.map((wp) => (
            <button
              key={wp.id}
              onClick={() => navigate(`/workplaces/${wp.id}`)}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: wp.color || '#6B7280' }}
                />
                <h3 className="font-semibold truncate">{wp.name}</h3>
                {!wp.is_active && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500">
                    {t('workplaces.archived')}
                  </span>
                )}
                {wp.has_consultation_pay && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 rounded-full text-blue-600 dark:text-blue-300">
                    {t('workplaces.consultationPayEnabled')}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{payModelLabel(wp.pay_model)}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{rateLabel(wp)}</span>
              </div>
              {wp.address && (
                <p className="text-xs text-gray-400 mt-2 truncate">{wp.address}</p>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <p className="text-gray-500 mb-4">{t('workplaces.noWorkplacesYet')}</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            {t('workplaces.addWorkplace')}
          </button>
        </div>
      )}

      {showCreate && (
        <WorkplaceFormModal
          onClose={() => setShowCreate(false)}
          onSuccess={(wp) => navigate(`/workplaces/${wp.id}`)}
        />
      )}
    </div>
  );
}
