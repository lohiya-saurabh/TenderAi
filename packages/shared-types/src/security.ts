export interface SecurityContextDto {
  tenantId: string;
  userId: string;
  companyId?: string;
  roles: Array<'ADMIN' | 'BID_MANAGER' | 'VIEWER'>;
  workflowRunId: string;
  correlationId: string;
  allowedDocumentIds: string[];
  allowedSourceIds: string[];
  purpose: string;
}

export interface UserSessionDto {
  userId: string;
  organizationId: string;
  email: string;
  role: 'ADMIN' | 'BID_MANAGER' | 'VIEWER';
}
