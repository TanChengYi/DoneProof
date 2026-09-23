import { describe, expect, it } from 'vitest';
import { redactAndLimit } from './redaction';

describe('redactAndLimit', () => {
  it('masks common credentials and explicit literals', () => {
    const result = redactAndLimit('token=abc123 sk-live-123456789 custom-secret', {
      maxBytes: 10_000,
      literals: ['custom-secret']
    });

    expect(result.output).toBe('token=[REDACTED] [REDACTED] [REDACTED]');
    expect(result.truncated).toBe(false);
  });

  it('limits output by encoded bytes', () => {
    const result = redactAndLimit('abcdefgh', { maxBytes: 5, literals: [] });

    expect(result.output).toBe('abcde');
    expect(result.truncated).toBe(true);
  });
});
