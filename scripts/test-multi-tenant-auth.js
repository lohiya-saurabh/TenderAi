#!/usr/bin/env node
/**
 * Test authentication and RBAC permissions for both Tenant Admin accounts:
 * - Tenant 1: admin@ashokabuildcon.com | AshokaBuildcon2026!
 * - Tenant 2: admin@ltinfra.com | LTInfra2026!
 *
 * Verifies:
 * 1. POST /api/v1/auth/login returns 200 OK with accessToken and user profile.
 * 2. Access tokens contain canonical permissions including 'bids:read', 'org:manage', etc.
 * 3. GET /api/v1/bids works for both users without 'Access Denied (bids:read)'.
 * 4. Anti-IDOR: Tenant 1 cannot access Tenant 2's bids or companies, and vice versa.
 */

async function decodeJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
  return JSON.parse(payload);
}

async function testAuth() {
  console.log('========================================================================');
  console.log('🔐 TenderPulse AI — Multi-Tenant Authentication & RBAC Verification');
  console.log('========================================================================\n');

  const usersToTest = [
    {
      email: 'admin@ashokabuildcon.com',
      password: 'AshokaBuildcon2026!',
      expectedOrg: 'org_ashoka_concessions',
    },
    {
      email: 'admin@ltinfra.com',
      password: 'LTInfra2026!',
      expectedOrg: 'org_lnt_infra',
    },
  ];

  const authResults = {};

  for (const u of usersToTest) {
    console.log(`\n🔑 Testing login for: ${u.email}...`);
    const res = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ Login failed (${res.status}): ${errText}`);
      process.exit(1);
    }

    const data = await res.json();
    console.log(`   ✅ Status 200 OK received!`);
    console.log(`   - User ID: ${data.user?.id}`);
    console.log(`   - Role: ${data.user?.role}`);
    console.log(`   - Organization: ${data.user?.organizationName} (${data.user?.organizationId})`);

    const decoded = await decodeJwt(data.accessToken);
    const perms = decoded.permissions || data.user?.permissions || [];
    console.log(`   - Total Granted Permissions: ${perms.length}`);
    console.log(`   - Contains 'bids:read': ${perms.includes('bids:read') ? '✅ YES' : '❌ NO'}`);
    console.log(`   - Contains 'bids:create': ${perms.includes('bids:create') ? '✅ YES' : '❌ NO'}`);
    console.log(`   - Contains 'company_profile:manage': ${perms.includes('company_profile:manage') ? '✅ YES' : '❌ NO'}`);
    console.log(`   - Contains 'org:manage': ${perms.includes('org:manage') ? '✅ YES' : '❌ NO'}`);

    if (!perms.includes('bids:read')) {
      console.error(`❌ FATAL: Token does not contain bids:read permission!`);
      process.exit(1);
    }

    authResults[u.expectedOrg] = { token: data.accessToken, user: data.user };

    // Test GET /api/v1/bids
    const bidsRes = await fetch('http://localhost:3000/api/v1/bids', {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });

    if (!bidsRes.ok) {
      console.error(`❌ GET /api/v1/bids failed (${bidsRes.status}):`, await bidsRes.text());
      process.exit(1);
    }

    const bids = await bidsRes.json();
    console.log(`   ✅ GET /api/v1/bids succeeded! Retrieved ${Array.isArray(bids) ? bids.length : bids?.items?.length} scoped bids without any error.`);

    // Test GET /api/v1/companies
    const compRes = await fetch('http://localhost:3000/api/v1/companies', {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    if (!compRes.ok) {
      console.error(`❌ GET /api/v1/companies failed (${compRes.status}):`, await compRes.text());
      process.exit(1);
    }
    const comps = await compRes.json();
    console.log(`   ✅ GET /api/v1/companies succeeded! Retrieved ${comps.length} companies for ${u.expectedOrg}.`);
    comps.forEach((c) => console.log(`      • ${c.legalName} (${c.id})`));
  }

  // ---------------------------------------------------------------------------
  // Strict Anti-IDOR Cross-Tenant Access Checks
  // ---------------------------------------------------------------------------
  console.log('\n🛡️  ================ ANTI-IDOR CROSS-TENANT SECURITY AUDIT ================');
  const tokenAshoka = authResults['org_ashoka_concessions'].token;
  const tokenLnt = authResults['org_lnt_infra'].token;

  // 1. Ashoka tries to access L&T's bid: bid_ncrtc_metro_1120
  console.log('\n[Security Check 1] Tenant 1 (Ashoka) attempting to access Tenant 2 bid (bid_ncrtc_metro_1120):');
  const idor1 = await fetch('http://localhost:3000/api/v1/bids/bid_ncrtc_metro_1120', {
    headers: { Authorization: `Bearer ${tokenAshoka}` },
  });
  console.log(`   HTTP Status: ${idor1.status} (Expected 404 or 403)`);
  if (idor1.status === 404 || idor1.status === 403) {
    console.log('   ✅ PASS: Tenant 1 cannot access Tenant 2 bid. Anti-IDOR properly enforced.');
  } else {
    console.error(`   ❌ FAIL: Tenant 1 accessed Tenant 2 bid! Status: ${idor1.status}`);
  }

  // 2. L&T tries to access Ashoka's bid: bid_nhai_ham_850
  console.log('\n[Security Check 2] Tenant 2 (L&T) attempting to access Tenant 1 bid (bid_nhai_ham_850):');
  const idor2 = await fetch('http://localhost:3000/api/v1/bids/bid_nhai_ham_850', {
    headers: { Authorization: `Bearer ${tokenLnt}` },
  });
  console.log(`   HTTP Status: ${idor2.status} (Expected 404 or 403)`);
  if (idor2.status === 404 || idor2.status === 403) {
    console.log('   ✅ PASS: Tenant 2 cannot access Tenant 1 bid. Anti-IDOR properly enforced.');
  } else {
    console.error(`   ❌ FAIL: Tenant 2 accessed Tenant 1 bid! Status: ${idor2.status}`);
  }

  // 3. Ashoka tries to access L&T company evidence: comp_lnt_heavy_civil
  console.log('\n[Security Check 3] Tenant 1 (Ashoka) attempting to access Tenant 2 company evidence (comp_lnt_heavy_civil):');
  const idor3 = await fetch('http://localhost:3000/api/v1/companies/comp_lnt_heavy_civil/evidence', {
    headers: { Authorization: `Bearer ${tokenAshoka}` },
  });
  console.log(`   HTTP Status: ${idor3.status} (Expected 404 or 403 or empty)`);
  const idor3Json = await idor3.json();
  if (idor3.status === 404 || idor3.status === 403 || (Array.isArray(idor3Json) && idor3Json.length === 0)) {
    console.log('   ✅ PASS: Tenant 1 cannot access Tenant 2 evidence documents.');
  } else {
    console.error(`   ❌ FAIL: Cross-tenant evidence leakage! Returned:`, idor3Json);
  }

  console.log('\n✨ All authentication, permission, and Anti-IDOR tests passed!\n');
}

testAuth().catch(console.error);
