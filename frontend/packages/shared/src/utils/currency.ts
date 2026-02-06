/**
 * Format cents to EUR display string.
 * Example: 254050 -> "EUR 2,540.50" or "2.540,50 €" (PT locale)
 */
export function formatEuros(cents: number, locale = 'pt-PT'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/**
 * Convert euros (float) to cents (integer).
 */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

/**
 * Convert cents (integer) to euros (float).
 */
export function centsToEuros(cents: number): number {
  return cents / 100;
}
