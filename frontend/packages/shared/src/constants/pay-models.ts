import type { PayModel, DayOfWeek } from '../types/workplace';

export const PAY_MODEL_OPTIONS: { value: PayModel; label: string; description: string }[] = [
  { value: 'hourly', label: 'Hourly', description: 'Paid per hour worked. Rate can vary by time of day and day of week.' },
  { value: 'per_turn', label: 'Per Turn', description: 'Fixed amount per shift/turn, regardless of duration.' },
  { value: 'monthly', label: 'Monthly', description: 'Fixed monthly salary, prorated based on expected hours.' },
];

export const DAYS_OF_WEEK: { value: DayOfWeek; label: string; short: string }[] = [
  { value: 'mon', label: 'Monday', short: 'Mon' },
  { value: 'tue', label: 'Tuesday', short: 'Tue' },
  { value: 'wed', label: 'Wednesday', short: 'Wed' },
  { value: 'thu', label: 'Thursday', short: 'Thu' },
  { value: 'fri', label: 'Friday', short: 'Fri' },
  { value: 'sat', label: 'Saturday', short: 'Sat' },
  { value: 'sun', label: 'Sunday', short: 'Sun' },
];

export const WEEKDAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
export const WEEKEND: DayOfWeek[] = ['sat', 'sun'];
export const ALL_DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WORKPLACE_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // orange
  '#8B5CF6', // purple
  '#F43F5E', // rose
  '#14B8A6', // teal
  '#0EA5E9', // sky
  '#D97706', // amber
];
