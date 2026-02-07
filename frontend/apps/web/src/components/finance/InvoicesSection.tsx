import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useInvoices, useCreateInvoice, useDeleteInvoice } from '../../lib/api';
import { formatEuros, centsToEuros, eurosToCents } from '@doctor-tracker/shared/utils/currency';
import type { Workplace } from '@doctor-tracker/shared/types/workplace';
import type { Invoice } from '@doctor-tracker/shared/types/finance';

interface Props {
  year: number;
  workplaces: Workplace[];
}

export function InvoicesSection({ year, workplaces }: Props) {
  const { t } = useTranslation();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const { data: invoices, isLoading } = useInvoices({ start, end });
  const [showForm, setShowForm] = useState(false);

  const total = invoices?.reduce((sum, inv) => sum + inv.gross_amount_cents, 0) ?? 0;
  const totalNet = invoices?.reduce((sum, inv) => sum + inv.net_amount_cents, 0) ?? 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('finance.recibosVerdes')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {invoices?.length ?? 0} {t('finance.invoices')}
              {total > 0 && <> &middot; {formatEuros(total)} {t('finance.gross').toLowerCase()} &middot; {formatEuros(totalNet)} {t('finance.net').toLowerCase()}</>}
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            {t('finance.newInvoice')}
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded" />)}
          </div>
        ) : invoices && invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left py-2 text-gray-500 font-medium">{t('finance.invoice')}</th>
                  <th className="text-left py-2 text-gray-500 font-medium">{t('finance.workplace')}</th>
                  <th className="text-left py-2 text-gray-500 font-medium">{t('finance.period')}</th>
                  <th className="text-right py-2 text-gray-500 font-medium">{t('finance.gross')}</th>
                  <th className="text-right py-2 text-gray-500 font-medium">{t('finance.withholdingShort')}</th>
                  <th className="text-right py-2 text-gray-500 font-medium">{t('finance.net')}</th>
                  <th className="text-right py-2 text-gray-500 font-medium">{t('finance.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const wp = workplaces.find((w) => w.id === inv.workplace_id);
                  return <InvoiceRow key={inv.id} invoice={inv} workplace={wp} />;
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            {t('finance.noInvoices', { year })}
          </p>
        )}
      </div>

      {showForm && (
        <InvoiceFormModal
          workplaces={workplaces}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function InvoiceRow({ invoice, workplace }: { invoice: Invoice; workplace?: Workplace }) {
  const { t, i18n } = useTranslation();
  const deleteMutation = useDeleteInvoice();
  const locale = i18n.language === 'pt' ? 'pt-PT' : 'en-GB';

  const handleDelete = () => {
    deleteMutation.mutate(invoice.id, {
      onSuccess: () => toast.success(t('finance.invoiceDeleted')),
      onError: () => toast.error(t('common.error')),
    });
  };

  const periodLabel = (() => {
    const start = new Date(invoice.period_start).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const end = new Date(invoice.period_end).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  })();

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800/50">
      <td className="py-2.5">
        <span className="font-medium">{invoice.invoice_number || '-'}</span>
        {invoice.issued_at && (
          <span className="text-xs text-gray-400 ml-2">
            {new Date(invoice.issued_at).toLocaleDateString(locale)}
          </span>
        )}
      </td>
      <td className="py-2.5">
        <div className="flex items-center gap-2">
          {workplace && (
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: workplace.color || '#6B7280' }} />
          )}
          <span className="truncate">{workplace?.name || 'Unknown'}</span>
        </div>
      </td>
      <td className="py-2.5 text-gray-500">{periodLabel}</td>
      <td className="py-2.5 text-right font-medium">{formatEuros(invoice.gross_amount_cents)}</td>
      <td className="py-2.5 text-right text-gray-500">
        {formatEuros(invoice.withholding_cents)} ({(invoice.withholding_rate * 100).toFixed(0)}%)
      </td>
      <td className="py-2.5 text-right font-medium text-income">{formatEuros(invoice.net_amount_cents)}</td>
      <td className="py-2.5 text-right">
        {invoice.paid_at ? (
          <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">{t('finance.paid')}</span>
        ) : (
          <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">{t('finance.pending')}</span>
        )}
      </td>
      <td className="py-2.5 text-right">
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="text-xs text-gray-400 hover:text-red-500"
        >
          {t('common.del')}
        </button>
      </td>
    </tr>
  );
}

function InvoiceFormModal({ workplaces, onClose }: { workplaces: Workplace[]; onClose: () => void }) {
  const { t } = useTranslation();
  const createMutation = useCreateInvoice();

  const [workplaceId, setWorkplaceId] = useState(workplaces[0]?.id || '');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [grossEuros, setGrossEuros] = useState('');
  const withholdingRate = '0.23';
  const ivaRate = '0';
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [error, setError] = useState('');

  const grossCents = eurosToCents(parseFloat(grossEuros) || 0);
  const withholdCents = Math.round(grossCents * parseFloat(withholdingRate));
  const ivaCents = Math.round(grossCents * parseFloat(ivaRate));
  const netCents = grossCents - withholdCents + ivaCents;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!workplaceId || !periodStart || !periodEnd || !grossEuros) {
      setError('Please fill all required fields');
      return;
    }

    try {
      await createMutation.mutateAsync({
        workplace_id: workplaceId,
        period_start: new Date(periodStart).toISOString(),
        period_end: new Date(periodEnd).toISOString(),
        gross_amount_cents: grossCents,
        withholding_rate: parseFloat(withholdingRate),
        iva_rate: parseFloat(ivaRate),
        invoice_number: invoiceNumber || undefined,
        issued_at: issuedAt ? new Date(issuedAt).toISOString() : undefined,
      });
      toast.success(t('finance.invoiceCreated'));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create invoice');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md m-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-semibold">{t('finance.newReciboVerde')}</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Workplace */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('finance.workplace')} *</label>
            <select
              value={workplaceId}
              onChange={(e) => setWorkplaceId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              {workplaces.map((wp) => (
                <option key={wp.id} value={wp.id}>{wp.name}</option>
              ))}
            </select>
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('finance.periodStart')} *</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('finance.periodEnd')} *</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          </div>

          {/* Gross Amount */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('finance.grossAmount')} *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={grossEuros}
              onChange={(e) => setGrossEuros(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              placeholder="2500.00"
            />
          </div>

          {/* Rates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('finance.withholdingRate')}</label>
              <div className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-400">
                23%
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('finance.ivaRate')}</label>
              <div className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-400">
                0%
              </div>
            </div>
          </div>

          {/* Calculation preview */}
          {grossCents > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('finance.gross')}</span>
                <span>{formatEuros(grossCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('finance.withholding')} ({(parseFloat(withholdingRate) * 100).toFixed(0)}%)</span>
                <span className="text-red-500">-{formatEuros(withholdCents)}</span>
              </div>
              {ivaCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">IVA ({(parseFloat(ivaRate) * 100).toFixed(0)}%)</span>
                  <span>+{formatEuros(ivaCents)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 font-semibold">
                <span>{t('finance.net')}</span>
                <span className="text-income">{formatEuros(netCents)}</span>
              </div>
            </div>
          )}

          {/* Invoice number & date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('finance.invoiceNumber')}</label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                placeholder="FT 2026/001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('finance.issuedDate')}</label>
              <input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending ? t('common.creating') : t('finance.createInvoice')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
