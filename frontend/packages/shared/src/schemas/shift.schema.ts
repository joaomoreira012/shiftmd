import { z } from 'zod';

export const createShiftSchema = z.object({
  workplace_id: z.string().uuid('Invalid workplace ID'),
  start_time: z.string().datetime({ message: 'Invalid start time' }),
  end_time: z.string().datetime({ message: 'Invalid end time' }),
  timezone: z.string(),
  title: z.string().max(255).optional(),
  notes: z.string().optional(),
  recurrence: z.object({
    rrule_string: z.string().min(1),
    until_date: z.string().datetime().optional(),
    count: z.number().int().positive().optional(),
  }).optional(),
}).refine(
  (data) => new Date(data.end_time) > new Date(data.start_time),
  { message: 'End time must be after start time', path: ['end_time'] }
);

export const updateShiftSchema = z.object({
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled']).optional(),
  title: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export type CreateShiftFormData = z.infer<typeof createShiftSchema>;
export type UpdateShiftFormData = z.infer<typeof updateShiftSchema>;
