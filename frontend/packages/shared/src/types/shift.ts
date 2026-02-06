import type { Workplace } from './workplace';

export type ShiftStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

export interface EarningSegment {
  start: string;
  end: string;
  hours: number;
  rate_cents: number;
  amount_cents: number;
  rule_name?: string;
}

export interface Shift {
  id: string;
  user_id: string;
  workplace_id: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: ShiftStatus;
  recurrence_rule_id?: string;
  original_start_time?: string;
  is_recurrence_exception: boolean;
  gcal_event_id?: string;
  title?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  workplace?: Workplace;
  earnings?: EarningSegment[];
  total_earnings?: number;
}

export interface CreateShiftInput {
  workplace_id: string;
  start_time: string;
  end_time: string;
  timezone?: string;
  title?: string;
  notes?: string;
  recurrence?: {
    rrule_string: string;
    until_date?: string;
    count?: number;
  };
}

export interface UpdateShiftInput {
  start_time?: string;
  end_time?: string;
  status?: ShiftStatus;
  title?: string;
  notes?: string;
}

export interface ShiftFilter {
  start: string;
  end: string;
  workplace_id?: string;
}
