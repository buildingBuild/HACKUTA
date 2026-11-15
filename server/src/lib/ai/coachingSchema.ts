// Coaching report contract: REQUIREMENTS.md §7.3. Must match exactly.
import { z } from 'zod';

export const CATEGORIES = [
  'crosshair_placement',
  'movement',
  'spray_control',
  'utility',
  'positioning',
  'decision_making',
] as const;
export type Category = (typeof CATEGORIES)[number];

const score = z.number().min(0).max(100);

export const CoachingReportSchema = z.object({
  overall_score: score,
  category_scores: z.object({
    crosshair_placement: score,
    movement: score,
    spray_control: score,
    utility: score,
    positioning: score,
    decision_making: score,
  }),
  notes: z
    .array(
      z.object({
        t: z.string().regex(/^\d{1,2}:\d{2}$/, 'timestamp must be mm:ss'),
        category: z.enum(CATEGORIES),
        severity: z.enum(['low', 'medium', 'high']),
        note: z.string().min(1),
        fix: z.string().min(1),
      }),
    )
    .min(1)
    .max(6),
  drills: z
    .array(
      z.object({
        name: z.string().min(1),
        where: z.string().min(1),
        minutes: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(3),
  summary: z.string().min(1),
});

export type CoachingReport = z.infer<typeof CoachingReportSchema>;

/**
 * JSON Schema handed to Gemini as `responseJsonSchema` so the model is forced
 * into the right shape. zod still validates afterwards (models can drift).
 */
const scoreJson = { type: 'integer', minimum: 0, maximum: 100 };
export const coachingJsonSchema = {
  type: 'object',
  properties: {
    overall_score: scoreJson,
    category_scores: {
      type: 'object',
      properties: Object.fromEntries(CATEGORIES.map((c) => [c, scoreJson])),
      required: [...CATEGORIES],
    },
    notes: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          t: { type: 'string', description: 'mm:ss timestamp in the clip' },
          category: { type: 'string', enum: [...CATEGORIES] },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          note: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['t', 'category', 'severity', 'note', 'fix'],
      },
    },
    drills: {
      type: 'array',
      minItems: 1,
      maxItems: 2,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          where: { type: 'string' },
          minutes: { type: 'integer' },
        },
        required: ['name', 'where', 'minutes'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['overall_score', 'category_scores', 'notes', 'drills', 'summary'],
} as const;
