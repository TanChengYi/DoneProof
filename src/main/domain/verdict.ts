import type { Criterion, CriterionVerdict, EvidenceResult, Verdict } from '../../shared/models';

export function deriveCriterionVerdict(criterion: Criterion, evidence: EvidenceResult[]): CriterionVerdict {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const referenced = criterion.evidenceIds.map((id) => byId.get(id));
  const base = { criterionId: criterion.id, evidenceIds: criterion.evidenceIds };

  if (criterion.evidenceIds.length === 0) {
    return { ...base, verdict: 'unproven', reason: 'No evidence is attached to this criterion' };
  }
  const failed = referenced.find((item) => item?.status === 'failed');
  if (failed) {
    return { ...base, verdict: 'failed', reason: `Evidence "${failed.label}" failed` };
  }
  const invalidArtifact = referenced.flatMap((item) => item?.artifacts ?? []).find((item) => item.integrity !== 'verified');
  if (invalidArtifact) {
    return {
      ...base,
      verdict: 'unproven',
      reason: `Artifact integrity is ${invalidArtifact.integrity}: ${invalidArtifact.path}`
    };
  }
  const missingId = criterion.evidenceIds.find((id) => !byId.has(id));
  if (missingId) {
    return { ...base, verdict: 'unproven', reason: `Referenced evidence is missing: ${missingId}` };
  }
  const inconclusive = referenced.find((item) => item?.status === 'unproven');
  if (inconclusive) {
    return { ...base, verdict: 'unproven', reason: `Evidence "${inconclusive.label}" is unproven` };
  }
  return { ...base, verdict: 'proven', reason: 'All referenced evidence passed with verified artifacts' };
}

export function deriveProjectVerdict(
  criteria: Array<Pick<CriterionVerdict, 'criterionId' | 'verdict'> & { required: boolean }>
): Verdict {
  const required = criteria.filter((item) => item.required);
  if (required.some((item) => item.verdict === 'failed')) return 'failed';
  if (required.length > 0 && required.every((item) => item.verdict === 'proven')) return 'proven';
  return 'unproven';
}
