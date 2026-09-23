export interface RedactionOptions {
  maxBytes: number;
  literals: string[];
}

export interface RedactedOutput {
  output: string;
  truncated: boolean;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function redact(value: string, literals: string[]): string {
  let output = value;
  for (const literal of [...literals].filter(Boolean).sort((a, b) => b.length - a.length)) {
    output = output.replace(new RegExp(escapeRegExp(literal), 'g'), '[REDACTED]');
  }
  output = output.replace(/\b(?:sk|ghp|github_pat)[-_][A-Za-z0-9_-]{8,}\b/g, '[REDACTED]');
  output = output.replace(/\b(token|password|secret|api[_-]?key)\s*([=:])\s*([^\s]+)/gi, '$1$2[REDACTED]');
  return output;
}

export function redactAndLimit(value: string, options: RedactionOptions): RedactedOutput {
  const redacted = redact(value, options.literals);
  const encoded = Buffer.from(redacted, 'utf8');
  if (encoded.byteLength <= options.maxBytes) return { output: redacted, truncated: false };
  return { output: encoded.subarray(0, options.maxBytes).toString('utf8'), truncated: true };
}
