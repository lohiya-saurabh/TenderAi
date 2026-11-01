/**
 * TenderDocumentRelevanceValidator
 *
 * Validates whether an uploaded document is legitimately relevant to the specific
 * tender project before it enters the ingestion, extraction, or compliance pipeline.
 *
 * Checks multi-dimensional signals:
 * 1. Specific Tender / NIT / RFP Reference Number
 * 2. Tendering Authority / Department / Organization
 * 3. Title / Project Name significant keyword overlap
 * 4. Location / State alignment
 * 5. Generic tender / procurement document markers (NIT, RFP, ITB, GCC, etc.)
 *
 * Preserves strict multi-tenant isolation and avoids hardcoding specific tender IDs.
 */

import { DocumentContentNormalizer } from '@/modules/bids/application/DocumentContentNormalizer.js';

export interface TenderMetadataInput {
  id: string;
  title: string;
  tenderNumber?: string | null;
  tenderingAuthority?: string | null;
  locationState?: string | null;
  estimatedValueRupees?: number | null;
}

export interface DocumentRelevanceValidationInput {
  documentId: string;
  fileName: string;
  content: Buffer | string;
  tender: TenderMetadataInput;
}

export interface DocumentRelevanceValidationResult {
  isRelevant: boolean;
  score: number; // 0 to 100
  matchedSignals: string[];
  rejectionReason?: string;
}

const COMMON_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
  'phase',
  'project',
  'work',
  'works',
  'services',
  'supply',
  'installation',
  'tender',
  'bidding',
  'document',
  'notice',
  'inviting',
  'contract',
  'construction',
]);

export class TenderDocumentRelevanceValidator {
  private readonly normalizer: DocumentContentNormalizer;

  constructor() {
    this.normalizer = new DocumentContentNormalizer();
  }

  public async validate(
    input: DocumentRelevanceValidationInput,
  ): Promise<DocumentRelevanceValidationResult> {
    const { fileName, content, tender } = input;

    // 1. Extract text layers from first 10 pages
    let documentText = '';
    try {
      const pages = await this.normalizer.normalize(content);
      // Aggregate first 10 pages or 35,000 characters
      documentText = pages
        .slice(0, 10)
        .map((p) => p.text)
        .join('\n')
        .slice(0, 35000)
        .toLowerCase();
    } catch {
      documentText = '';
    }

    const matchedSignals: string[] = [];
    let score = 0;

    const lowerFileName = fileName.toLowerCase();
    const docCorpus = `${lowerFileName} ${documentText}`;

    // Signal A: Explicit Tender Reference Number (High confidence, +45 points)
    if (tender.tenderNumber && tender.tenderNumber.trim().length > 3) {
      const cleanRef = tender.tenderNumber.trim().toLowerCase();
      // Test full tender number match
      if (docCorpus.includes(cleanRef)) {
        score += 45;
        matchedSignals.push(`Exact tender reference number match: "${tender.tenderNumber}"`);
      } else {
        // Test non-trivial sub-tokens (e.g., "CIVIL-0491", "ITS-0118", "2026/CIVIL")
        const tokens = cleanRef.split(/[\/\-_ ]+/).filter((t) => t.length >= 4);
        const matchedTokens = tokens.filter((t) => docCorpus.includes(t));
        if (matchedTokens.length >= 2 || (tokens.length === 1 && matchedTokens.length === 1)) {
          score += 35;
          matchedSignals.push(`Tender reference segments matched: [${matchedTokens.join(', ')}]`);
        }
      }
    }

    // Signal B: Tendering Authority / Department (+20 points)
    if (tender.tenderingAuthority && tender.tenderingAuthority.trim().length > 2) {
      const cleanAuthority = tender.tenderingAuthority.trim().toLowerCase();
      if (docCorpus.includes(cleanAuthority)) {
        score += 20;
        matchedSignals.push(`Full tendering authority match: "${tender.tenderingAuthority}"`);
      } else {
        // Test authority acronyms in parentheses or significant words (e.g. CPWD, NHAI, MHA)
        const acronymMatch = tender.tenderingAuthority.match(/\(([^)]+)\)/);
        const acronym =
          acronymMatch && acronymMatch[1] ? acronymMatch[1].trim().toLowerCase() : null;
        if (acronym && acronym.length >= 3 && docCorpus.includes(acronym)) {
          score += 15;
          matchedSignals.push(`Authority acronym match: "${acronym.toUpperCase()}"`);
        } else {
          // Check significant words of authority
          const authWords = cleanAuthority
            .replace(/[()]/g, '')
            .split(/[\s,]+/)
            .filter((w) => w.length >= 4 && !COMMON_STOP_WORDS.has(w));
          const matchedAuthWords = authWords.filter((w) => docCorpus.includes(w));
          if (matchedAuthWords.length >= 2) {
            score += 15;
            matchedSignals.push(`Authority key terms matched: [${matchedAuthWords.join(', ')}]`);
          }
        }
      }
    }

    // Signal C: Project Title Significant Keyword Overlap (+25 points)
    if (tender.title && tender.title.trim().length > 3) {
      const cleanTitle = tender.title.trim().toLowerCase();
      if (docCorpus.includes(cleanTitle)) {
        score += 35;
        matchedSignals.push(`Exact project title match: "${tender.title}"`);
      } else {
        const titleTokens = cleanTitle
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((t) => t.length >= 4 && !COMMON_STOP_WORDS.has(t));

        if (titleTokens.length > 0) {
          const matchedTitleTokens = titleTokens.filter((t) => docCorpus.includes(t));
          const overlapRatio = matchedTitleTokens.length / titleTokens.length;

          if (overlapRatio >= 0.5) {
            score += 25;
            matchedSignals.push(
              `Significant title keyword overlap (${Math.round(overlapRatio * 100)}%): [${matchedTitleTokens.join(', ')}]`,
            );
          } else if (matchedTitleTokens.length >= 2) {
            score += 15;
            matchedSignals.push(
              `Partial title keywords matched: [${matchedTitleTokens.join(', ')}]`,
            );
          }
        }
      }
    }

    // Signal D: Location / State alignment (+10 points)
    if (tender.locationState && tender.locationState.trim().length >= 3) {
      const loc = tender.locationState.trim().toLowerCase();
      if (docCorpus.includes(loc)) {
        score += 10;
        matchedSignals.push(`Project location matched: "${tender.locationState}"`);
      }
    }

    // Signal E: Standard Procurement & Tender Document Markers (+10 points)
    const PROCUREMENT_MARKERS = [
      'notice inviting tender',
      'request for proposal',
      'instruction to bidders',
      'instructions to bidders',
      'general conditions of contract',
      'special conditions of contract',
      'bidding document',
      'tender document',
      'concession agreement',
      'model concession agreement',
      'scope of work',
      'bill of quantities',
      'contract data',
      'letter of invitation',
      'corrigendum',
      'addendum',
    ];
    const foundMarkers = PROCUREMENT_MARKERS.filter((m) => docCorpus.includes(m));
    if (foundMarkers.length > 0) {
      score += 10;
      matchedSignals.push(
        `Procurement markers identified: [${foundMarkers.slice(0, 3).join(', ')}]`,
      );
    }

    // Signal F: If document has virtually no extractable text (e.g. non-OCR scanned binary)
    // but the file name strongly aligns with the tender, allow reasonable fallback
    if (documentText.length < 50 && score < 30) {
      const fileNameScore = this.evaluateFileNameFallback(lowerFileName, tender);
      if (fileNameScore >= 35) {
        score = fileNameScore;
        matchedSignals.push(`File name pattern match for scanned binary: "${fileName}"`);
      }
    }

    // Acceptance Threshold: Score >= 30 points
    const isRelevant = score >= 30;

    if (!isRelevant) {
      const rejectionReason =
        `The uploaded document "${fileName}" does not appear to belong to tender "${tender.title}". ` +
        `Verified tender reference number (${tender.tenderNumber || 'N/A'}), tendering authority (${tender.tenderingAuthority || 'N/A'}), ` +
        `or key project identifiers could not be found in the document content. ` +
        `Please ensure you are uploading the authentic tender document for this bid.`;

      return {
        isRelevant: false,
        score,
        matchedSignals,
        rejectionReason,
      };
    }

    return {
      isRelevant: true,
      score: Math.min(100, score),
      matchedSignals,
    };
  }

  private evaluateFileNameFallback(lowerFileName: string, tender: TenderMetadataInput): number {
    let fnScore = 0;
    if (tender.tenderNumber) {
      const refTokens = tender.tenderNumber
        .toLowerCase()
        .split(/[\/\-_ ]+/)
        .filter((t) => t.length >= 4);
      if (refTokens.some((t) => lowerFileName.includes(t))) {
        fnScore += 35;
      }
    }
    if (tender.tenderingAuthority) {
      const acronymMatch = tender.tenderingAuthority.match(/\(([^)]+)\)/);
      const acronym = acronymMatch && acronymMatch[1] ? acronymMatch[1].trim().toLowerCase() : null;
      if (acronym && lowerFileName.includes(acronym)) {
        fnScore += 25;
      }
    }
    const titleTokens = tender.title
      .toLowerCase()
      .split(/[\s\-_]+/)
      .filter((t) => t.length >= 4 && !COMMON_STOP_WORDS.has(t));
    const matchedTitle = titleTokens.filter((t) => lowerFileName.includes(t));
    if (matchedTitle.length >= 2) {
      fnScore += 25;
    }
    return fnScore;
  }
}
