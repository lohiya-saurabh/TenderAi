import { InvalidProvenanceException } from '@/common/domain/DomainException.js';

export interface ProvenanceProps {
  sourceDocumentId: string;
  sourceFileName: string;
  pageNumber: number;
  clauseReference: string;
  verbatimQuote: string;
  /** Deterministic validation score in [0, 1]; null when none was computed. */
  confidenceScore: number | null;
}

export class Provenance {
  public readonly sourceDocumentId: string;
  public readonly sourceFileName: string;
  public readonly pageNumber: number;
  public readonly clauseReference: string;
  public readonly verbatimQuote: string;
  public readonly confidenceScore: number | null;

  constructor(props: ProvenanceProps) {
    if (!props.sourceDocumentId || props.sourceDocumentId.trim() === '') {
      throw new InvalidProvenanceException('sourceDocumentId', 'Must not be empty');
    }
    if (!props.sourceFileName || props.sourceFileName.trim() === '') {
      throw new InvalidProvenanceException('sourceFileName', 'Must not be empty');
    }
    if (!Number.isInteger(props.pageNumber) || props.pageNumber < 1) {
      throw new InvalidProvenanceException('pageNumber', 'Must be a positive integer >= 1');
    }
    if (!props.clauseReference || props.clauseReference.trim() === '') {
      throw new InvalidProvenanceException('clauseReference', 'Must not be empty');
    }
    if (!props.verbatimQuote || props.verbatimQuote.trim() === '') {
      throw new InvalidProvenanceException(
        'verbatimQuote',
        'Must not be empty (zero-ungrounded claims policy)',
      );
    }
    if (
      props.confidenceScore !== null &&
      (typeof props.confidenceScore !== 'number' ||
        props.confidenceScore < 0.0 ||
        props.confidenceScore > 1.0)
    ) {
      throw new InvalidProvenanceException(
        'confidenceScore',
        'Must be a float between 0.0 and 1.0',
      );
    }

    this.sourceDocumentId = props.sourceDocumentId;
    this.sourceFileName = props.sourceFileName.trim();
    this.pageNumber = props.pageNumber;
    this.clauseReference = props.clauseReference.trim();
    this.verbatimQuote = props.verbatimQuote.trim();
    this.confidenceScore =
      props.confidenceScore === null ? null : Math.round(props.confidenceScore * 100) / 100;

    Object.freeze(this);
  }

  public toJSON(): ProvenanceProps {
    return {
      sourceDocumentId: this.sourceDocumentId,
      sourceFileName: this.sourceFileName,
      pageNumber: this.pageNumber,
      clauseReference: this.clauseReference,
      verbatimQuote: this.verbatimQuote,
      confidenceScore: this.confidenceScore,
    };
  }
}
