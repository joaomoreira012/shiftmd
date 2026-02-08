import type { ShiftStatus } from '../types/shift';

export interface StatusColorInfo {
  /** Tailwind badge classes (used in ShiftDetailModal and sidebar) */
  badge: string;
  /** Icon/indicator shown in calendar event titles */
  icon: string;
}

export const SHIFT_STATUS_COLORS: Record<ShiftStatus, StatusColorInfo> = {
  scheduled: {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: '\u23F3', // hourglass
  },
  confirmed: {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: '\u2713', // check mark
  },
  completed: {
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    icon: '\u2713\u2713', // double check mark
  },
  cancelled: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: '\u2717', // ballot x
  },
};

export const ALL_SHIFT_STATUSES: ShiftStatus[] = ['scheduled', 'confirmed', 'completed', 'cancelled'];
