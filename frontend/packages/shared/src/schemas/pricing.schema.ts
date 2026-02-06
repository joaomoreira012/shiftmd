import { z } from 'zod';

const dayOfWeekSchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

export const createPricingRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(255),
  priority: z.number().int().min(0),
  time_start: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format').optional(),
  time_end: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format').optional(),
  days_of_week: z.array(dayOfWeekSchema).optional(),
  specific_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  rate_cents: z.number().int().min(0).optional(),
  rate_multiplier: z.number().positive().optional(),
}).refine(
  (data) => (data.rate_cents !== undefined) !== (data.rate_multiplier !== undefined),
  { message: 'Must set either rate_cents or rate_multiplier, not both' }
);

export type CreatePricingRuleFormData = z.infer<typeof createPricingRuleSchema>;
