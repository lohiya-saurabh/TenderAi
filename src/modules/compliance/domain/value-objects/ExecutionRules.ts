import { InvalidExecutionRulesException } from '../../../../common/domain/DomainException.js';

export interface ExecutionRulesProps {
  stampPaperRequired: boolean;
  stampPaperDenominationInr?: number;
  notarizationRequired: boolean;
  signingAuthorityRank?: string;
  udinRequired: boolean;
}

export class ExecutionRules {
  public readonly stampPaperRequired: boolean;
  public readonly stampPaperDenominationInr: number;
  public readonly notarizationRequired: boolean;
  public readonly signingAuthorityRank: string;
  public readonly udinRequired: boolean;

  constructor(props: ExecutionRulesProps) {
    this.stampPaperRequired = props.stampPaperRequired;
    this.notarizationRequired = props.notarizationRequired;
    this.udinRequired = props.udinRequired;

    if (props.stampPaperRequired) {
      if (!props.stampPaperDenominationInr || props.stampPaperDenominationInr <= 0) {
        throw new InvalidExecutionRulesException(
          'stampPaperDenominationInr must be greater than 0 when stampPaperRequired is true.'
        );
      }
      this.stampPaperDenominationInr = props.stampPaperDenominationInr;
    } else {
      this.stampPaperDenominationInr = props.stampPaperDenominationInr ?? 0;
    }

    this.signingAuthorityRank = props.signingAuthorityRank?.trim() ?? 'Authorized Signatory';

    Object.freeze(this);
  }

  public toJSON(): ExecutionRulesProps {
    return {
      stampPaperRequired: this.stampPaperRequired,
      stampPaperDenominationInr: this.stampPaperDenominationInr,
      notarizationRequired: this.notarizationRequired,
      signingAuthorityRank: this.signingAuthorityRank,
      udinRequired: this.udinRequired,
    };
  }
}
