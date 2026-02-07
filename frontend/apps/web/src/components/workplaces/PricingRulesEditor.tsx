import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { createPricingRuleSchema, type CreatePricingRuleFormData } from '@doctor-tracker/shared/schemas/pricing.schema';
import { DAYS_OF_WEEK, WEEKDAYS, WEEKEND, ALL_DAYS } from '@doctor-tracker/shared/constants/pay-models';
import { usePricingRules, useCreatePricingRule, useDeletePricingRule, useUpdatePricingRule } from '../../lib/api';
import { formatEuros, centsToEuros, eurosToCents } from '@doctor-tracker/shared/utils/currency';
import type { PricingRule, DayOfWeek } from '@doctor-tracker/shared/types/workplace';

interface Props {
  workplaceId: string;
  baseRateCents: number;
}

const PRESETS = [
  {
    name: 'Standard Hospital',
    rules: [
      { name: 'Weekday Day', priority: 1, time_start: '08:00', time_end: '20:00', days_of_week: WEEKDAYS as DayOfWeek[], rate_multiplier: 1.0 },
      { name: 'Weekday Night', priority: 2, time_start: '20:00', time_end: '08:00', days_of_week: WEEKDAYS as DayOfWeek[], rate_multiplier: 1.25 },
      { name: 'Weekend Day', priority: 3, time_start: '08:00', time_end: '20:00', days_of_week: WEEKEND as DayOfWeek[], rate_multiplier: 1.5 },
      { name: 'Weekend Night', priority: 4, time_start: '20:00', time_end: '08:00', days_of_week: WEEKEND as DayOfWeek[], rate_multiplier: 1.75 },
    ],
  },
  {
    name: 'Simple Day/Night',
    rules: [
      { name: 'Day', priority: 1, time_start: '08:00', time_end: '22:00', days_of_week: ALL_DAYS as DayOfWeek[], rate_multiplier: 1.0 },
      { name: 'Night', priority: 2, time_start: '22:00', time_end: '08:00', days_of_week: ALL_DAYS as DayOfWeek[], rate_multiplier: 1.25 },
    ],
  },
];

export function PricingRulesEditor({ workplaceId, baseRateCents }: Props) {
  const { t } = useTranslation();
  const { data: rules, isLoading } = usePricingRules(workplaceId);
  const createMutation = useCreatePricingRule();
  const deleteMutation = useDeletePricingRule();
  const updateMutation = useUpdatePricingRule();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);

  const applyPreset = async (preset: typeof PRESETS[number]) => {
    try {
      // Delete existing rules first
      if (rules) {
        for (const rule of rules) {
          await deleteMutation.mutateAsync({ workplaceId, ruleId: rule.id });
        }
      }
      // Create new rules from preset
      for (const rule of preset.rules) {
        await createMutation.mutateAsync({ workplaceId, data: rule });
      }
      toast.success(t('pricing.presetApplied', { name: preset.name }));
    } catch {
      toast.error('Failed to apply preset');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('pricing.title')}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('pricing.description')}
            </p>
          </div>
          <div className="flex gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded" />)}
          </div>
        ) : rules && rules.length > 0 ? (
          <div className="space-y-3">
            {rules.sort((a, b) => a.priority - b.priority).map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                baseRateCents={baseRateCents}
                onEdit={() => setEditingRule(rule)}
                onDelete={() => deleteMutation.mutate({ workplaceId, ruleId: rule.id })}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            {t('pricing.noRules')}
          </p>
        )}

        <button
          onClick={() => setShowAddForm(true)}
          className="mt-4 w-full py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-500 hover:border-primary-300 hover:text-primary-600 transition-colors"
        >
          {t('pricing.addRule')}
        </button>
      </div>

      {(showAddForm || editingRule) && (
        <RuleFormModal
          workplaceId={workplaceId}
          existingRule={editingRule}
          nextPriority={rules ? Math.max(0, ...rules.map(r => r.priority)) + 1 : 1}
          baseRateCents={baseRateCents}
          onClose={() => { setShowAddForm(false); setEditingRule(null); }}
        />
      )}
    </div>
  );
}

function RuleCard({
  rule,
  baseRateCents,
  onEdit,
  onDelete,
  isDeleting,
}: {
  rule: PricingRule;
  baseRateCents: number;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { t } = useTranslation();
  const rateDisplay = rule.rate_cents != null
    ? formatEuros(rule.rate_cents)
    : `${rule.rate_multiplier}x (${formatEuros(Math.round(baseRateCents * (rule.rate_multiplier ?? 1)))})`;

  const dayLabels = rule.days_of_week?.length === 7
    ? t('pricing.everyDay')
    : rule.days_of_week?.length === 5 && rule.days_of_week.every((d) => WEEKDAYS.includes(d))
      ? t('pricing.weekdays')
      : rule.days_of_week?.length === 2 && rule.days_of_week.every((d) => WEEKEND.includes(d))
        ? t('pricing.weekend')
        : rule.days_of_week?.map((d) => DAYS_OF_WEEK.find((dw) => dw.value === d)?.short).join(', ') || t('pricing.anyDay');

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <span className="text-xs text-gray-400 font-mono w-6 text-center">#{rule.priority}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{rule.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {dayLabels} &middot; {rule.time_start || '00:00'}–{rule.time_end || '24:00'}
        </p>
      </div>
      <span className="text-sm font-semibold text-income whitespace-nowrap">{rateDisplay}</span>
      <div className="flex gap-1">
        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-gray-600 text-xs">{t('common.edit')}</button>
        <button onClick={onDelete} disabled={isDeleting} className="p-1.5 text-gray-400 hover:text-red-500 text-xs">{t('common.del')}</button>
      </div>
    </div>
  );
}

function RuleFormModal({
  workplaceId,
  existingRule,
  nextPriority,
  baseRateCents,
  onClose,
}: {
  workplaceId: string;
  existingRule: PricingRule | null;
  nextPriority: number;
  baseRateCents: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const createMutation = useCreatePricingRule();
  const updateMutation = useUpdatePricingRule();
  const isEditing = !!existingRule;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [rateMode, setRateMode] = useState<'fixed' | 'multiplier'>(
    existingRule?.rate_multiplier != null ? 'multiplier' : 'fixed'
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreatePricingRuleFormData>({
    resolver: zodResolver(createPricingRuleSchema),
    defaultValues: existingRule
      ? {
          name: existingRule.name,
          priority: existingRule.priority,
          time_start: existingRule.time_start || '',
          time_end: existingRule.time_end || '',
          days_of_week: existingRule.days_of_week || [],
          rate_cents: existingRule.rate_cents,
          rate_multiplier: existingRule.rate_multiplier,
        }
      : {
          name: '',
          priority: nextPriority,
          time_start: '08:00',
          time_end: '20:00',
          days_of_week: [...WEEKDAYS] as DayOfWeek[],
          rate_cents: baseRateCents,
        },
  });

  const selectedDays = watch('days_of_week') || [];
  const multiplierVal = watch('rate_multiplier');

  const toggleDay = (day: DayOfWeek) => {
    const current = selectedDays;
    if (current.includes(day)) {
      setValue('days_of_week', current.filter((d) => d !== day));
    } else {
      setValue('days_of_week', [...current, day]);
    }
  };

  const setDayPreset = (days: DayOfWeek[]) => {
    setValue('days_of_week', days);
  };

  const onSubmit = async (data: CreatePricingRuleFormData) => {
    // Ensure only one rate type is set
    const submitData = { ...data };
    if (rateMode === 'fixed') {
      delete submitData.rate_multiplier;
    } else {
      delete submitData.rate_cents;
    }

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ workplaceId, ruleId: existingRule.id, data: submitData });
        toast.success(t('pricing.ruleUpdated'));
      } else {
        await createMutation.mutateAsync({ workplaceId, data: submitData });
        toast.success(t('pricing.ruleAdded'));
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save rule');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-semibold">{isEditing ? t('pricing.editRule') : t('pricing.addPricingRule')}</h3>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Name & Priority */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">{t('pricing.name') + ' *'}</label>
              <input
                {...register('name')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                placeholder="Night shift"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('pricing.priority')}</label>
              <input
                type="number"
                {...register('priority', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          </div>

          {/* Time Range */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('pricing.timeRange')}</label>
            <div className="flex items-center gap-2">
              <input
                {...register('time_start')}
                type="time"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
              <span className="text-gray-400">to</span>
              <input
                {...register('time_end')}
                type="time"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{t('pricing.overnightHint')}</p>
          </div>

          {/* Days of Week */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('pricing.days')}</label>
            <div className="flex gap-3 mb-2">
              <button type="button" onClick={() => setDayPreset([...WEEKDAYS] as DayOfWeek[])} className="text-xs text-primary-600 hover:underline">{t('pricing.weekdays')}</button>
              <button type="button" onClick={() => setDayPreset([...WEEKEND] as DayOfWeek[])} className="text-xs text-primary-600 hover:underline">{t('pricing.weekend')}</button>
              <button type="button" onClick={() => setDayPreset([...ALL_DAYS] as DayOfWeek[])} className="text-xs text-primary-600 hover:underline">{t('pricing.all')}</button>
            </div>
            <div className="flex gap-1.5">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                    selectedDays.includes(day.value)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {day.short.charAt(0)}
                </button>
              ))}
            </div>
          </div>

          {/* Rate */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('pricing.rate')}</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => { setRateMode('multiplier'); setValue('rate_cents', undefined); if (!multiplierVal) setValue('rate_multiplier', 1.0); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  rateMode === 'multiplier' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {t('pricing.multiplier')}
              </button>
              <button
                type="button"
                onClick={() => { setRateMode('fixed'); setValue('rate_multiplier', undefined); if (!watch('rate_cents')) setValue('rate_cents', baseRateCents); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  rateMode === 'fixed' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {t('pricing.fixedRate')}
              </button>
            </div>
            {rateMode === 'multiplier' ? (
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    {...register('rate_multiplier', { valueAsNumber: true })}
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  />
                  <span className="text-sm text-gray-400">
                    x base = {formatEuros(Math.round(baseRateCents * (multiplierVal ?? 1)))}/hr
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">EUR</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full pl-12 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  value={centsToEuros(watch('rate_cents') ?? 0)}
                  onChange={(e) => setValue('rate_cents', eurosToCents(parseFloat(e.target.value) || 0))}
                />
              </div>
            )}
          </div>

          {/* Schema-level error */}
          {errors.root && <p className="text-red-500 text-xs">{errors.root.message}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {isPending ? t('common.saving') : isEditing ? t('pricing.updateRule') : t('pricing.addRule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
