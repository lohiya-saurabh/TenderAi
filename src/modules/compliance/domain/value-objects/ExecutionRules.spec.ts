import { describe, it, expect } from 'vitest';
import { InvalidExecutionRulesException } from '../../../../common/domain/DomainException.js';
import { ExecutionRules } from './ExecutionRules.js';

describe('ExecutionRules Value Object', () => {
  it('should successfully instantiate valid execution rules with stamp paper', () => {
    const rules = new ExecutionRules({
      stampPaperRequired: true,
      stampPaperDenominationInr: 100,
      notarizationRequired: true,
      signingAuthorityRank: 'Executive Engineer or above',
      udinRequired: false,
    });

    expect(rules.stampPaperRequired).toBe(true);
    expect(rules.stampPaperDenominationInr).toBe(100);
    expect(rules.notarizationRequired).toBe(true);
    expect(rules.signingAuthorityRank).toBe('Executive Engineer or above');
    expect(rules.udinRequired).toBe(false);
    expect(Object.isFrozen(rules)).toBe(true);
  });

  it('should throw InvalidExecutionRulesException if stamp paper is required but denomination is 0 or missing', () => {
    expect(
      () =>
        new ExecutionRules({
          stampPaperRequired: true,
          stampPaperDenominationInr: 0,
          notarizationRequired: true,
          udinRequired: false,
        })
    ).toThrow(InvalidExecutionRulesException);
  });

  it('should allow stampPaperRequired = false without denomination', () => {
    const rules = new ExecutionRules({
      stampPaperRequired: false,
      notarizationRequired: false,
      udinRequired: true,
    });

    expect(rules.stampPaperRequired).toBe(false);
    expect(rules.stampPaperDenominationInr).toBe(0);
    expect(rules.udinRequired).toBe(true);
  });
});
