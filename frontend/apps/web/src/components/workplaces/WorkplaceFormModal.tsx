import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { createWorkplaceSchema, type CreateWorkplaceFormData } from '@doctor-tracker/shared/schemas/workplace.schema';
import { PAY_MODEL_OPTIONS, WORKPLACE_COLORS } from '@doctor-tracker/shared/constants/pay-models';
import { useCreateWorkplace, useUpdateWorkplace } from '../../lib/api';
import { centsToEuros, eurosToCents } from '@doctor-tracker/shared/utils/currency';
import type { Workplace } from '@doctor-tracker/shared/types/workplace';

interface Props {
  workplace?: Workplace;
  onClose: () => void;
  onSuccess: (workplace: Workplace) => void;
}

export function WorkplaceFormModal({ workplace, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const isEditing = !!workplace;
  const createMutation = useCreateWorkplace();
  const updateMutation = useUpdateWorkplace();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateWorkplaceFormData>({
    resolver: zodResolver(createWorkplaceSchema),
    defaultValues: workplace
      ? {
          name: workplace.name,
          address: workplace.address || '',
          color: workplace.color || WORKPLACE_COLORS[0],
          pay_model: workplace.pay_model,
          base_rate_cents: workplace.base_rate_cents,
          currency: workplace.currency,
          monthly_expected_hours: workplace.monthly_expected_hours,
          has_consultation_pay: workplace.has_consultation_pay,
          has_outside_visit_pay: workplace.has_outside_visit_pay,
          withholding_rate: workplace.withholding_rate,
          contact_name: workplace.contact_name || '',
          contact_phone: workplace.contact_phone || '',
          contact_email: workplace.contact_email || '',
          notes: workplace.notes || '',
        }
      : {
          name: '',
          color: WORKPLACE_COLORS[0],
          pay_model: 'hourly',
          base_rate_cents: 0,
          currency: 'EUR',
          has_consultation_pay: false,
          has_outside_visit_pay: false,
          withholding_rate: 0.25,
        },
  });

  const selectedColor = watch('color');
  const payModel = watch('pay_model');

  const onSubmit = async (data: CreateWorkplaceFormData) => {
    try {
      if (isEditing) {
        const result = await updateMutation.mutateAsync({ id: workplace.id, data });
        toast.success(t('workplaces.editWorkplace'));
        onSuccess(result);
      } else {
        const result = await createMutation.mutateAsync(data);
        toast.success(t('workplaces.createWorkplace'));
        onSuccess(result);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save workplace');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">{isEditing ? t('workplaces.editWorkplace') : t('workplaces.newWorkplace')}</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('workplaces.name') + ' *'}</label>
            <input
              {...register('name')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Hospital Santa Maria"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('workplaces.color')}</label>
            <div className="flex gap-2">
              {WORKPLACE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue('color', color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    selectedColor === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Pay Model */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('workplaces.payModel') + ' *'}</label>
            <div className="grid grid-cols-3 gap-2">
              {PAY_MODEL_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    payModel === opt.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    {...register('pay_model')}
                    value={opt.value}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-xs text-gray-500 text-center mt-1">{opt.description.split('.')[0]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Base Rate - input in euros, stored as cents */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('workplaces.baseRate') + ' *'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">EUR</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full pl-12 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={centsToEuros(watch('base_rate_cents'))}
                onChange={(e) => setValue('base_rate_cents', eurosToCents(parseFloat(e.target.value) || 0))}
              />
            </div>
            {errors.base_rate_cents && <p className="text-red-500 text-xs mt-1">{errors.base_rate_cents.message}</p>}
            <p className="text-xs text-gray-400 mt-1">
              {payModel === 'hourly' && t('workplaces.perHour')}
              {payModel === 'per_turn' && t('workplaces.perTurn')}
              {payModel === 'monthly' && t('workplaces.monthly')}
            </p>
          </div>

          {/* Monthly expected hours (only for monthly) */}
          {payModel === 'monthly' && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('workplaces.expectedHours')}</label>
              <input
                type="number"
                {...register('monthly_expected_hours', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="160"
              />
            </div>
          )}

          {/* Withholding Rate */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('workplaces.withholdingRate')}</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={Math.round(watch('withholding_rate') * 1000) / 10}
                onChange={(e) => setValue('withholding_rate', (parseFloat(e.target.value) || 0) / 100)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
            {errors.withholding_rate && <p className="text-red-500 text-xs mt-1">{errors.withholding_rate.message}</p>}
          </div>

          {/* Consultation Pay Toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={watch('has_consultation_pay')}
                onChange={(e) => setValue('has_consultation_pay', e.target.checked, { shouldDirty: true })}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium">{t('workplaces.hasConsultationPay')}</span>
            </label>
          </div>

          {/* Outside Visit Pay Toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={watch('has_outside_visit_pay')}
                onChange={(e) => setValue('has_outside_visit_pay', e.target.checked, { shouldDirty: true })}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium">{t('workplaces.hasOutsideVisitPay')}</span>
            </label>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('workplaces.address')}</label>
            <input
              {...register('address')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Av. Professor Egas Moniz, Lisboa"
            />
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('workplaces.contactName')}</label>
              <input
                {...register('contact_name')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('workplaces.contactPhone')}</label>
              <input
                {...register('contact_phone')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('workplaces.notes')}</label>
            <textarea
              {...register('notes')}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>

          {/* Error */}
          {(createMutation.error || updateMutation.error) && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {(createMutation.error || updateMutation.error)?.message || 'Failed to save workplace'}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isPending ? t('common.saving') : isEditing ? t('common.saveChanges') : t('workplaces.createWorkplace')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
