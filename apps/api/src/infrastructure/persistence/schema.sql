-- PostgreSQL DDL for TenderPulse AI Core
-- Enforces Multi-Tenancy, Strict Foreign Keys, Optimistic Concurrency, and JSONB indexing

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Bids Table
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    tender_number VARCHAR(100) NOT NULL,
    tendering_authority VARCHAR(255) NOT NULL,
    estimated_value_paise BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    submission_deadline TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bids_org ON bids(organization_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(organization_id, status);

-- 2. Compliance Items Table
CREATE TABLE IF NOT EXISTS compliance_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    execution_rules JSONB NOT NULL,
    provenance JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    user_notes TEXT,
    assigned_user_id UUID,
    version INT NOT NULL DEFAULT 1,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_bid_org ON compliance_items(organization_id, bid_id);
CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_items(bid_id, status);
CREATE INDEX IF NOT EXISTS idx_compliance_execution_rules ON compliance_items USING GIN (execution_rules);

-- 3. Immutable Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    diff JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_org_entity ON audit_logs(organization_id, entity_type, entity_id);
