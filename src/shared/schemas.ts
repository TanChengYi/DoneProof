import { z } from 'zod';

const idSchema = z.string().trim().min(1).max(120);

export const criterionSchema = z.object({
  id: idSchema,
  text: z.string().trim().min(1, 'Criterion text is required').max(2_000),
  required: z.boolean(),
  evidenceIds: z.array(idSchema).default([])
});

export const checkDefinitionSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1).max(200),
  executable: z.string().trim().min(1).max(500),
  args: z.array(z.string().max(2_000)).max(100),
  timeoutMs: z.number().int().min(1_000).max(3_600_000),
  maxOutputBytes: z.number().int().min(1_024).max(50_000_000)
});

const browserStepSchema = z.discriminatedUnion('type', [
  z.object({ id: idSchema, type: z.literal('visit'), path: z.string().min(1).max(2_000) }),
  z.object({ id: idSchema, type: z.literal('click'), selector: z.string().min(1).max(2_000) }),
  z.object({ id: idSchema, type: z.literal('fill'), selector: z.string().min(1).max(2_000), value: z.string().max(10_000) }),
  z.object({ id: idSchema, type: z.literal('press'), selector: z.string().min(1).max(2_000), key: z.string().min(1).max(100) }),
  z.object({ id: idSchema, type: z.literal('assertText'), selector: z.string().min(1).max(2_000), text: z.string().max(10_000) }),
  z.object({ id: idSchema, type: z.literal('assertVisible'), selector: z.string().min(1).max(2_000) }),
  z.object({ id: idSchema, type: z.literal('assertUrl'), value: z.string().min(1).max(2_000) }),
  z.object({ id: idSchema, type: z.literal('screenshot'), name: z.string().trim().min(1).max(200), fullPage: z.boolean() })
]);

export const browserScenarioSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(200),
  baseUrl: z.url(),
  readinessUrl: z.url().optional(),
  timeoutMs: z.number().int().min(1_000).max(600_000),
  startCheckId: idSchema.optional(),
  criterionIds: z.array(idSchema),
  steps: z.array(browserStepSchema).min(1).max(100)
});

export const proofContractSchema = z.object({
  version: z.literal(1),
  goal: z.string().trim().min(1, 'Goal is required').max(5_000),
  criteria: z.array(criterionSchema).min(1, 'At least one criterion is required').max(200),
  checks: z.array(checkDefinitionSchema).max(100),
  scenarios: z.array(browserScenarioSchema).max(100)
});
