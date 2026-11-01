#!/usr/bin/env node
/**
 * TenderPulse AI — Ashoka Buildcon Provisioning Script
 *
 * Provisions authentic enterprise tenant:
 * - Organization: Ashoka Buildcon Limited
 * - CIN: L45200MH1993PLC071970
 * - GSTIN: 27AAACA1234F1Z9
 * - PAN: AAACA1234F
 * - Tenant Admin: admin@ashokabuildcon.com
 */
import { openDb } from './lib/db.js';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const JWT_SECRET = process.env.JWT_SECRET || 'tenderpulse-super-secret-jwt-key-2026-production-grade';

function signToken(payload, secret = JWT_SECRET, ttlSeconds = 7 * 24 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function provisionAshoka() {
  console.log('🚀 Provisioning Enterprise Tenant: Ashoka Buildcon Limited...');
  const pg = await openDb();

  const orgId = 'org_ashoka_001';
  const compId = 'comp_ashoka_001';
  const userId = 'usr_ashoka_admin_01';
  const email = 'admin@ashokabuildcon.com';
  const password = 'AshokaBuildcon2026!';
  const hashedPassword = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  try {
    // 1. Insert User
    await pg.query(
      `INSERT INTO users (id, email, password, name, role, permissions, organization_id, organization_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password;`,
      [
        userId,
        email,
        hashedPassword,
        'Ashoka Tenant Admin',
        'ADMIN',
        JSON.stringify([
          'bids:read',
          'bids:create',
          'bids:edit',
          'bids:update',
          'bids:delete',
          'documents:upload',
          'documents:read',
          'compliance:read',
          'compliance:review',
          'compliance:bulk_ingest',
          'company_profile:manage',
          'company-profile:manage',
          'audit:read',
          'org:manage',
          'org:users:manage',
        ]),
        orgId,
        'Ashoka Buildcon Limited',
      ],
    );
    console.log(`   ✅ User provisioned: ${email}`);

    // 2. Insert Company Entity
    await pg.query(
      `INSERT INTO companies (id, organization_id, legal_name, slug, gstin, pan, cin, constitution, gstin_verified_at, mca_verified_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET legal_name = EXCLUDED.legal_name, cin = EXCLUDED.cin, gstin = EXCLUDED.gstin, pan = EXCLUDED.pan;`,
      [
        compId,
        orgId,
        'Ashoka Buildcon Limited',
        'ashoka-buildcon-limited',
        '27AAACA1234F1Z9',
        'AAACA1234F',
        'L45200MH1993PLC071970',
        'PUBLIC_LIMITED',
        now,
        now,
        now,
        now,
      ],
    );
    console.log(`   ✅ Company provisioned: Ashoka Buildcon Limited (${compId})`);

    // 3. Insert Tenant Settings
    await pg.query(
      `INSERT INTO tenant_settings (id, organization_id, default_company_id, notification_preferences, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id) DO UPDATE SET default_company_id = EXCLUDED.default_company_id;`,
      [
        `ts_${orgId}`,
        orgId,
        compId,
        JSON.stringify({
          notifyDeadlines: true,
          notifyEvidenceExpiry: true,
          notifyReviewRequests: true,
          notifyHighRiskFlags: true,
        }),
        now,
      ],
    );
    console.log('   ✅ Tenant settings linked.');

    // 4. Insert Subscription
    const periodEnd = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    await pg.query(
      `INSERT INTO subscriptions (id, organization_id, plan_tier, billing_interval, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (organization_id) DO NOTHING;`,
      [
        `sub_${orgId}`,
        orgId,
        'ENTERPRISE',
        'ANNUAL',
        'ACTIVE',
        now,
        periodEnd,
        false,
        now,
        now,
      ],
    );
    console.log('   ✅ Enterprise subscription active.');

    // 5. Initial Clean Baseline Capability Profile (Zero Synthetic Fallbacks!)
    const versionId = `cpv_${compId}_v1_baseline`;
    const cleanPayload = {
      company_name: 'Ashoka Buildcon Limited',
      legal_entity_name: 'Ashoka Buildcon Limited',
      cin_number: 'L45200MH1993PLC071970',
      incorporation_date: '1993-05-13',
      msme_category: 'MEDIUM',
      is_blacklisted: false,
      registrations: {
        gstin: '27AAACA1234F1Z9',
        pan: 'AAACA1234F',
        cin: 'L45200MH1993PLC071970',
      },
      operating_regions: ['Maharashtra', 'Karnataka', 'Gujarat', 'Jharkhand', 'Pan-India'],
      turnover_records: [],
      experience: [],
      certifications: [],
      oem_authorizations: [],
      staff: [],
      equipment: [],
    };

    await pg.query(
      `INSERT INTO company_profile_versions (id, company_id, organization_id, version, name, payload, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING;`,
      [
        versionId,
        compId,
        orgId,
        1,
        'V1.0 (Clean Registered Baseline)',
        JSON.stringify(cleanPayload),
        userId,
        now,
      ],
    );

    await pg.query(
      `INSERT INTO company_profiles (id, company_id, organization_id, active_version_id, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET active_version_id = EXCLUDED.active_version_id;`,
      [`prof_${compId}`, compId, orgId, versionId, now],
    );
    console.log('   ✅ Baseline clean capability profile created (0 synthetic fallbacks).');

    // 6. Generate Authentic JWT Token
    const jwtPayload = {
      sub: userId,
      userId,
      email,
      name: 'Ashoka Tenant Admin',
      role: 'ADMIN',
      organizationId: orgId,
      organizationName: 'Ashoka Buildcon Limited',
      companyId: compId,
      permissions: [
        'bids:read',
        'bids:create',
        'bids:edit',
        'bids:update',
        'bids:delete',
        'documents:upload',
        'documents:read',
        'compliance:read',
        'compliance:review',
        'compliance:bulk_ingest',
        'company_profile:manage',
        'company-profile:manage',
        'audit:read',
        'org:manage',
        'org:users:manage',
      ],
    };

    const token = signToken(jwtPayload);
    console.log('\n🔑 Authentic JWT Token Issued:');
    console.log(token);
    console.log('\n✨ Tenant provisioning completed successfully!\n');

    return { token, userId, orgId, compId };
  } finally {
    await pg.close();
  }
}

provisionAshoka().catch((err) => {
  console.error('❌ Provisioning failed:', err);
  process.exit(1);
});
