-- ============================================================================
-- TenderPulse AI — Canonical PostgreSQL 16 DDL Schema
-- Complete multi-tenant schema with 17 operational tables, foreign keys, and indexes.
-- ============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'BID_MANAGER',
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  organization_id TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Tenant Settings Table
CREATE TABLE IF NOT EXISTS tenant_settings (
  id TEXT PRIMARY KEY,
  organization_id TEXT UNIQUE NOT NULL,
  default_company_id TEXT,
  notification_preferences JSONB NOT NULL DEFAULT '{"inApp": true, "email": true, "slack": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Companies Table (Multi-Company Support within Tenant)
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  slug TEXT,
  gstin TEXT,
  pan TEXT,
  udyam_id TEXT,
  constitution TEXT,
  cin TEXT,
  gstin_verified_at TIMESTAMPTZ,
  gstin_verification_data JSONB,
  udyam_verified_at TIMESTAMPTZ,
  udyam_verification_data JSONB,
  mca_verified_at TIMESTAMPTZ,
  mca_verification_data JSONB,
  digilocker_linked_at TIMESTAMPTZ,
  digilocker_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_org ON companies(organization_id);

-- 4. Company Evidence Documents (Evidence Vault)
CREATE TABLE IF NOT EXISTS company_evidence_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  issuer TEXT,
  reference_number TEXT,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  source_provider TEXT NOT NULL DEFAULT 'LOCAL_UPLOAD',
  verification_status TEXT NOT NULL DEFAULT 'IMPORTED',
  verification_method TEXT NOT NULL DEFAULT 'METADATA_EXTRACTED',
  verification_payload JSONB,
  discrepancy_notes TEXT,
  extracted_attributes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_ev_docs_comp ON company_evidence_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_comp_ev_docs_org ON company_evidence_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_comp_ev_status ON company_evidence_documents(company_id, verification_status);

-- 5. Evidence Verification History (Append-Only Audit Trail)
CREATE TABLE IF NOT EXISTS evidence_verification_history (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  evidence_document_id TEXT NOT NULL REFERENCES company_evidence_documents(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  verification_method TEXT NOT NULL,
  verified_by TEXT NOT NULL,
  verification_payload JSONB,
  discrepancy_notes TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ev_hist_doc ON evidence_verification_history(evidence_document_id);
CREATE INDEX IF NOT EXISTS idx_ev_hist_comp ON evidence_verification_history(company_id);

-- 6. Bids Table
CREATE TABLE IF NOT EXISTS bids (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  title TEXT NOT NULL,
  tender_number TEXT NOT NULL DEFAULT '',
  tendering_authority TEXT NOT NULL DEFAULT '',
  estimated_value_rupees BIGINT NOT NULL DEFAULT 0,
  submission_deadline TEXT,
  location_state TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  total_requirements INT NOT NULL DEFAULT 0,
  flagged_requirements INT NOT NULL DEFAULT 0,
  approved_requirements INT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bids_org ON bids(organization_id);

-- 7. Tender Documents Table
CREATE TABLE IF NOT EXISTS tender_documents (
  id TEXT PRIMARY KEY,
  bid_id TEXT NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  document_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UPLOADED',
  processing_attempts INT NOT NULL DEFAULT 0,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  last_processing_error TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tender_documents_bid_org ON tender_documents(bid_id, organization_id);

-- 8. Compliance Items Table
CREATE TABLE IF NOT EXISTS compliance_items (
  id TEXT PRIMARY KEY,
  bid_id TEXT NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  company_id TEXT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  human_review_required BOOLEAN NOT NULL DEFAULT TRUE,
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  execution_rules JSONB NOT NULL,
  provenance JSONB NOT NULL,
  company_evidence JSONB,
  risk JSONB,
  rationale JSONB,
  workflow_run_id TEXT,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_items_bid_org ON compliance_items(bid_id, organization_id);

-- 9. Transactional Outbox Table
CREATE TABLE IF NOT EXISTS document_processing_outbox (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_document_processing_outbox_pending
  ON document_processing_outbox(status, next_attempt_at);

-- 10. Audit Logs Table (Append-Only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  bid_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_bid ON audit_logs(organization_id, bid_id);

-- 11. Company Profile Versions (Immutable Snapshots)
CREATE TABLE IF NOT EXISTS company_profile_versions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_id TEXT,
  version INT NOT NULL,
  version_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_profile_versions_org
  ON company_profile_versions(organization_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_company_profile_versions_comp
  ON company_profile_versions(company_id, version DESC);

-- 12. Company Profiles (Active Version Pointer)
CREATE TABLE IF NOT EXISTS company_profiles (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  active_version_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Bid Decisions (Immutable Audit Records)
CREATE TABLE IF NOT EXISTS bid_decisions (
  id TEXT PRIMARY KEY,
  bid_id TEXT NOT NULL,
  company_id TEXT,
  organization_id TEXT NOT NULL,
  profile_version_id TEXT NOT NULL,
  verdict TEXT NOT NULL,
  state TEXT NOT NULL,
  readiness_score REAL NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bid_decisions_bid ON bid_decisions(bid_id, organization_id);

-- 14. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  recipient_user_id TEXT,
  recipient_email TEXT,
  category TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'IN_APP',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant
  ON notifications(organization_id, recipient_user_id, is_read, created_at DESC);

-- 15. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  plan_tier TEXT NOT NULL DEFAULT 'FREE',
  billing_interval TEXT NOT NULL DEFAULT 'MONTHLY',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Usage Records Table
CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  period_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_records_tenant_period
  ON usage_records(organization_id, metric, period_key);

-- 17. Refresh Tokens Table (Server-Side Session Revocation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
