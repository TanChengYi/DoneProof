import { describe, expect, it } from 'vitest';
import { proofContractSchema } from './schemas';

describe('proofContractSchema', () => {
  it('rejects a criterion without text', () => {
    expect(() =>
      proofContractSchema.parse({
        version: 1,
        goal: 'Ship',
        criteria: [{ id: 'c1', text: '', required: true, evidenceIds: [] }],
        checks: [],
        scenarios: []
      })
    ).toThrow();
  });
});
