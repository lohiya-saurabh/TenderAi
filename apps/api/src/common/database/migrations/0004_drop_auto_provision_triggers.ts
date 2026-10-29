/**
 * 0004 — drop the auto-provision triggers.
 *
 * The baseline created BEFORE INSERT triggers that invented any missing parent row
 * (organizations, companies, bids, evidence documents, and ADMIN users with a placeholder
 * password hash). A broken insert now fails on its foreign key instead of fabricating data.
 */
import type { Migration } from './types.js';

export const migration0004DropAutoProvisionTriggers: Migration = {
  id: '0004_drop_auto_provision_triggers',
  sql: `
    DROP TRIGGER IF EXISTS trg_auto_org_companies ON companies;
    DROP TRIGGER IF EXISTS trg_auto_org_users ON users;
    DROP TRIGGER IF EXISTS trg_auto_org_bids ON bids;
    DROP TRIGGER IF EXISTS trg_auto_comp_bids ON bids;
    DROP TRIGGER IF EXISTS trg_auto_org_tenant_settings ON tenant_settings;
    DROP TRIGGER IF EXISTS trg_auto_org_subscriptions ON subscriptions;
    DROP TRIGGER IF EXISTS trg_auto_org_usage_records ON usage_records;
    DROP TRIGGER IF EXISTS trg_auto_org_comp_prof_ver ON company_profile_versions;
    DROP TRIGGER IF EXISTS trg_auto_comp_comp_prof_ver ON company_profile_versions;
    DROP TRIGGER IF EXISTS trg_auto_org_comp_profiles ON company_profiles;
    DROP TRIGGER IF EXISTS trg_auto_comp_comp_profiles ON company_profiles;
    DROP TRIGGER IF EXISTS trg_auto_org_comp_ev_docs ON company_evidence_documents;
    DROP TRIGGER IF EXISTS trg_auto_comp_comp_ev_docs ON company_evidence_documents;
    DROP TRIGGER IF EXISTS trg_auto_org_comp_ev_chunks ON company_evidence_chunks;
    DROP TRIGGER IF EXISTS trg_auto_comp_comp_ev_chunks ON company_evidence_chunks;
    DROP TRIGGER IF EXISTS trg_auto_ev_doc_chunks ON company_evidence_chunks;
    DROP TRIGGER IF EXISTS trg_auto_org_ev_hist ON evidence_verification_history;
    DROP TRIGGER IF EXISTS trg_auto_comp_ev_hist ON evidence_verification_history;
    DROP TRIGGER IF EXISTS trg_auto_org_tender_docs ON tender_documents;
    DROP TRIGGER IF EXISTS trg_auto_bid_tender_docs ON tender_documents;
    DROP TRIGGER IF EXISTS trg_auto_org_compliance_items ON compliance_items;
    DROP TRIGGER IF EXISTS trg_auto_bid_compliance_items ON compliance_items;
    DROP TRIGGER IF EXISTS trg_auto_org_bid_decisions ON bid_decisions;
    DROP TRIGGER IF EXISTS trg_auto_bid_bid_decisions ON bid_decisions;
    DROP TRIGGER IF EXISTS trg_auto_user_refresh_tokens ON refresh_tokens;
    DROP TRIGGER IF EXISTS trg_auto_org_notifications ON notifications;
    DROP TRIGGER IF EXISTS trg_auto_org_audit_logs ON audit_logs;
    DROP TRIGGER IF EXISTS trg_auto_org_chat_conv ON chat_conversations;
    DROP TRIGGER IF EXISTS trg_auto_org_chat_msg ON chat_messages;
    DROP TRIGGER IF EXISTS trg_auto_org_tender_chunks ON tender_document_chunks;
    DROP FUNCTION IF EXISTS auto_provision_bid();
    DROP FUNCTION IF EXISTS auto_provision_comp();
    DROP FUNCTION IF EXISTS auto_provision_ev_doc();
    DROP FUNCTION IF EXISTS auto_provision_org();
    DROP FUNCTION IF EXISTS auto_provision_user();
  `,
};
