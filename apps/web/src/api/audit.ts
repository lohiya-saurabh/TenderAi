/**
 * TenderPulse AI — Audit API
 *
 * Immutable audit trail event logs.
 */

import { apiGet, type ApiResult, type RequestOptions } from '@/api/client.js';

export interface AuditEvent {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  userId: string;
  userName?: string;
  organizationId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

/** List audit trail events for a bid */
export function listAuditEvents(
  bidId: string,
  options?: RequestOptions,
): Promise<ApiResult<AuditEvent[]>> {
  return apiGet<AuditEvent[]>(`/api/v1/bids/${bidId}/audit-events`, options);
}
