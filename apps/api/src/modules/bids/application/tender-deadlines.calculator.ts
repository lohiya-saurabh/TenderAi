export type MilestoneStatus = 'UPCOMING' | 'IMMINENT' | 'OVERDUE' | 'NOT_SET';

export interface TenderMilestone {
  milestoneKey: string;
  label: string;
  date: string | null;
  daysRemaining: number | null;
  status: MilestoneStatus;
  isMandatory: boolean;
  notes: string;
}

export interface TenderDeadlinesResult {
  bidId: string;
  tenderNumber: string;
  submissionDeadline: string | null;
  daysRemaining: number | null;
  milestones: TenderMilestone[];
}

/**
 * Calculates comprehensive tender lifecycle milestone deadlines for a bid.
 */
export function calculateTenderDeadlines(
  bid: {
    id: string;
    tenderNumber: string;
    submissionDeadline: string | null;
  },
  now = new Date(),
): TenderDeadlinesResult {
  const submissionDate = bid.submissionDeadline ? new Date(bid.submissionDeadline) : null;
  const isValidSubmissionDate = submissionDate && !Number.isNaN(submissionDate.getTime());

  let daysRemaining: number | null = null;
  if (isValidSubmissionDate && submissionDate) {
    daysRemaining = Math.ceil((submissionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  const formatMilestoneDate = (baseDate: Date | null, offsetDays: number): string | null => {
    if (!baseDate) return null;
    const target = new Date(baseDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
    return target.toISOString().split('T')[0] ?? null;
  };

  const getMilestoneStatus = (dateStr: string | null): MilestoneStatus => {
    if (!dateStr) return 'NOT_SET';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'NOT_SET';
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'OVERDUE';
    if (days <= 7) return 'IMMINENT';
    return 'UPCOMING';
  };

  const getDaysLeft = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const preBidDate = isValidSubmissionDate ? formatMilestoneDate(submissionDate, -15) : null;
  const clarificationDate = isValidSubmissionDate
    ? formatMilestoneDate(submissionDate, -10)
    : null;
  const technicalOpeningDate = isValidSubmissionDate
    ? formatMilestoneDate(submissionDate, 1)
    : null;
  const financialOpeningDate = isValidSubmissionDate
    ? formatMilestoneDate(submissionDate, 8)
    : null;

  const milestones: TenderMilestone[] = [
    {
      milestoneKey: 'PRE_BID_MEETING',
      label: 'Pre-Bid Meeting & Queries',
      date: preBidDate,
      daysRemaining: getDaysLeft(preBidDate),
      status: getMilestoneStatus(preBidDate),
      isMandatory: false,
      notes: 'Submit technical and contractual queries before the cutoff window.',
    },
    {
      milestoneKey: 'CLARIFICATION_CUTOFF',
      label: 'Pre-Bid Clarification Window Closing',
      date: clarificationDate,
      daysRemaining: getDaysLeft(clarificationDate),
      status: getMilestoneStatus(clarificationDate),
      isMandatory: false,
      notes: 'Procuring authority releases corrigenda & response to pre-bid queries.',
    },
    {
      milestoneKey: 'EMD_SUBMISSION',
      label: 'EMD & Tender Fee Physical / SFMS Submission',
      date: bid.submissionDeadline,
      daysRemaining,
      status: getMilestoneStatus(bid.submissionDeadline),
      isMandatory: true,
      notes: 'Original BG / DD physical submission or SFMS transmission confirmation.',
    },
    {
      milestoneKey: 'BID_SUBMISSION_FREEZE',
      label: 'Online Bid Submission Deadline',
      date: bid.submissionDeadline,
      daysRemaining,
      status: getMilestoneStatus(bid.submissionDeadline),
      isMandatory: true,
      notes: 'Hard portal cutoff. Encrypted packet lock on e-procurement portal.',
    },
    {
      milestoneKey: 'TECHNICAL_BID_OPENING',
      label: 'Technical Bid Opening Date',
      date: technicalOpeningDate,
      daysRemaining: getDaysLeft(technicalOpeningDate),
      status: getMilestoneStatus(technicalOpeningDate),
      isMandatory: false,
      notes: 'Technical bid envelope decryption and qualification review.',
    },
    {
      milestoneKey: 'FINANCIAL_BID_OPENING',
      label: 'Financial Bid Opening Date (Estimated)',
      date: financialOpeningDate,
      daysRemaining: getDaysLeft(financialOpeningDate),
      status: getMilestoneStatus(financialOpeningDate),
      isMandatory: false,
      notes: 'BOQ price discovery for technically qualified bidders.',
    },
  ];

  return {
    bidId: bid.id,
    tenderNumber: bid.tenderNumber,
    submissionDeadline: bid.submissionDeadline,
    daysRemaining,
    milestones,
  };
}
