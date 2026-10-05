/**
 * TenderPulse AI — Deadline Utilities
 *
 * Shared, pure deadline math used by the dashboard tender list
 * and the tender detail page. Single source of truth for the
 * days-left / urgency classification.
 */

export type DeadlineUrgency = 'passed' | 'urgent' | 'soon' | 'normal';

export interface DeadlineInfo {
  daysLeft: number;
  urgency: DeadlineUrgency;
}

/**
 * Days until a deadline with urgency classification.
 * Urgency bands (shared with the dashboard's 7-day action window):
 *   passed  — deadline is in the past
 *   urgent  — due within 2 days
 *   soon    — due within 7 days
 *   normal  — more than 7 days out
 */
export function getDeadlineInfo(isoDeadline: string, nowMs: number): DeadlineInfo {
  const deadlineMs = new Date(isoDeadline).getTime();
  const daysLeft = Math.ceil((deadlineMs - nowMs) / (24 * 60 * 60 * 1000));
  if (deadlineMs <= nowMs) return { daysLeft, urgency: 'passed' };
  if (daysLeft <= 2) return { daysLeft, urgency: 'urgent' };
  if (daysLeft <= 7) return { daysLeft, urgency: 'soon' };
  return { daysLeft, urgency: 'normal' };
}
