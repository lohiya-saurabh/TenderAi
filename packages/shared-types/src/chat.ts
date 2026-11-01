export type ChatMessageRole = 'user' | 'assistant' | 'tool' | 'system';

export type CitationSourceType = 'TENDER_DOCUMENT' | 'COMPANY_EVIDENCE';

export interface CitationBoundingBox {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  pageWidth?: number | string;
  pageHeight?: number | string;
  [key: string]: unknown;
}

export interface CitationDto {
  citationId: string;
  sourceType: CitationSourceType;
  documentId: string;
  documentName: string;
  pageNumber: number;
  clauseReference?: string | null;
  verbatimQuote: string;
  confidenceScore?: number;
  boundingBox?: CitationBoundingBox | null;
}

export interface ToolCallDto {
  toolName: string;
  arguments: Record<string, unknown>;
  result?: Record<string, unknown> | unknown[] | string | null;
}

export interface FinancialSummaryCardDto {
  evaluated: boolean;
  metricName: string;
  requiredValue: string;
  actualValue: string;
  verdict: 'PASS' | 'FAIL' | 'REVIEW';
  udin?: string | null;
  details?: string | null;
}

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  organizationId: string;
  role: ChatMessageRole;
  content: string;
  toolCalls?: ToolCallDto[] | null;
  citations?: CitationDto[] | null;
  financialSummary?: FinancialSummaryCardDto | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ChatConversationDto {
  id: string;
  organizationId: string;
  companyId?: string | null;
  bidId?: string | null;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendChatMessageRequest {
  message: string;
  conversationId?: string;
  bidId?: string;
  companyId?: string;
}

export interface SendChatMessageResponse {
  conversationId: string;
  message: ChatMessageDto;
  suggestedFollowups?: string[];
}

export interface TenderDocumentChunkDto {
  id?: string;
  chunkId?: string;
  chunkIndex: number;
  chunkType: string;
  content: string;
  pageNumber: number;
  sectionTitle?: string | null;
  clauseReference?: string | null;
  boundingBox?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  embedding?: number[] | null;
}
