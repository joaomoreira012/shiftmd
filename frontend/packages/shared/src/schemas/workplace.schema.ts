import { z } from 'zod';

export const payModelSchema = z.enum(['hourly', 'per_turn', 'monthly']);

export const createWorkplaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  address: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  pay_model: payModelSchema,
  base_rate_cents: z.number().int().min(0, 'Rate must be positive'),
  currency: z.string().length(3),
  monthly_expected_hours: z.number().positive().optional(),
  has_consultation_pay: z.boolean(),
  contact_name: z.string().max(255).optional(),
  contact_phone: z.string().max(50).optional(),
  contact_email: z.union([z.string().email(), z.literal('')]).optional(),
  notes: z.string().optional(),
});

export const updateWorkplaceSchema = createWorkplaceSchema.partial();

export type CreateWorkplaceFormData = z.infer<typeof createWorkplaceSchema>;
export type UpdateWorkplaceFormData = z.infer<typeof updateWorkplaceSchema>;
