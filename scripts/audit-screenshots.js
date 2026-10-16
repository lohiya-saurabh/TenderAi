import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'playwright-screenshots');

async function main() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('🚀 Launching Playwright Chromium for Comprehensive Multi-Tenant UI Audit...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  async function snap(name, fullPage = false) {
    const dest = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: dest, fullPage });
    console.log(`   📸 Captured: ${name}.png`);
    return dest;
  }

  try {
    // =========================================================================
    // TENANT 1 AUDIT: Ashoka Group Infrastructure (admin@ashokabuildcon.com)
    // =========================================================================
    console.log('\n--- [TENANT 1 AUDIT: Ashoka Group Infrastructure] ---');

    // 1. Login Page
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
    await snap('01_login_ashoka');

    // 2. Perform Login as Ashoka Admin
    await page.fill('#email', 'admin@ashokabuildcon.com');
    await page.fill('#password', 'AshokaBuildcon2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/bids', { timeout: 10000 });
    await page.waitForTimeout(1500);
    console.log('   ✅ Logged in as admin@ashokabuildcon.com');

    // 3. Ashoka Dashboard
    await snap('02_dashboard_ashoka');
    await snap('02_dashboard_ashoka_full', true);

    // 4. Company Profile — Ashoka Buildcon Limited
    await page.goto('http://localhost:5173/company-profile', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap('03_profile_ashoka_buildcon');
    await snap('03_profile_ashoka_buildcon_full', true);

    // 5. Test Company Switcher in Header -> Switch to Ashoka Concessions Limited
    const switcherBtn = await page.$('button[title="Switch Business Entity / Company"]');
    if (switcherBtn) {
      await switcherBtn.click();
      await page.waitForTimeout(500);
      const concessionsItem = await page.$('button:has-text("Ashoka Concessions Limited")');
      if (concessionsItem) {
        await concessionsItem.click();
        await page.waitForTimeout(1500);
        await snap('04_profile_ashoka_concessions');
        console.log('   ✅ Switched active company to Ashoka Concessions Limited');
      }

      // 6. Switch to Viva Highways Limited
      await page.click('button[title="Switch Business Entity / Company"]');
      await page.waitForTimeout(500);
      const vivaItem = await page.$('button:has-text("Viva Highways Limited")');
      if (vivaItem) {
        await vivaItem.click();
        await page.waitForTimeout(1500);
        await snap('05_profile_viva_highways');
        console.log('   ✅ Switched active company to Viva Highways Limited');
      }

      // Switch back to Ashoka Buildcon
      await page.click('button[title="Switch Business Entity / Company"]');
      await page.waitForTimeout(500);
      const buildconItem = await page.$('button:has-text("Ashoka Buildcon Limited")');
      if (buildconItem) {
        await buildconItem.click();
        await page.waitForTimeout(1000);
      }
    }

    // 7. Evidence Vault & 780px Streaming Preview Drawer
    const vaultBtn = await page.$('button:has-text("Evidence Vault (")') || await page.$('button:has-text("Evidence Vault")');
    if (vaultBtn) {
      await vaultBtn.click();
      await page.waitForTimeout(1200);
      await snap('06_evidence_vault_ashoka');

      // Click "Inspect Document ↗" on the first card
      const inspectBtn = await page.$('button:has-text("Inspect Document")');
      if (inspectBtn) {
        await inspectBtn.click();
        await page.waitForTimeout(2500);
        await snap('07_evidence_preview_drawer_780px');
        console.log('   ✅ Captured 780px Evidence Preview Drawer');

        // Close drawer
        const closeBtn = await page.$('button:has-text("Close Viewer")');
        if (closeBtn) await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 8. Tender Detail — NHAI 4-Laning HAM Highway (₹850 Cr)
    await page.goto('http://localhost:5173/bids/bid_nhai_ham_850', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await snap('08_tender_detail_nhai_ham');
    await snap('08_tender_detail_nhai_ham_full', true);

    // 9. Compliance Matrix Section
    const compSection = await page.$('#compliance-matrix') || await page.$('table');
    if (compSection) {
      await compSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await snap('09_compliance_matrix_section');
    }

    // 10. Bid Verdict Card / Decision Section (GO 96%)
    const verdictCard = await page.$('#bid-verdict-card') || await page.$('section:has-text("DETERMINISTIC ELIGIBILITY VERDICT")');
    if (verdictCard) {
      await verdictCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await snap('10_bid_decision_go_96');
    }

    // 11. Viva Highways Intersecting Tender (RVNL Railway Bridge - NO_GO 42%)
    await page.goto('http://localhost:5173/bids/bid_viva_rvnl_rail_test', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await snap('11_viva_nogo_decision');
    await snap('11_viva_nogo_decision_full', true);

    // Clear session for Tenant 2
    await page.evaluate(() => localStorage.clear());
    await context.clearCookies();

    // =========================================================================
    // TENANT 2 AUDIT: L&T Civil Infrastructure Holdings (admin@ltinfra.com)
    // =========================================================================
    console.log('\n--- [TENANT 2 AUDIT: L&T Civil Infrastructure Holdings] ---');

    // 12. Login Page for L&T
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
    await snap('12_login_lnt');

    // 13. Perform Login as L&T Admin
    await page.fill('#email', 'admin@ltinfra.com');
    await page.fill('#password', 'LTInfra2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/bids', { timeout: 10000 });
    await page.waitForTimeout(1500);
    console.log('   ✅ Logged in as admin@ltinfra.com');

    // 14. L&T Dashboard
    await snap('13_dashboard_lnt');
    await snap('13_dashboard_lnt_full', true);

    // 15. L&T Company Profile — Heavy Civil IC
    await page.goto('http://localhost:5173/company-profile', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap('14_profile_lnt_heavy_civil');
    await snap('14_profile_lnt_heavy_civil_full', true);

    // 16. Switch to L&T Transportation Infrastructure
    const lntSwitcher = await page.$('button[title="Switch Business Entity / Company"]');
    if (lntSwitcher) {
      await lntSwitcher.click();
      await page.waitForTimeout(500);
      const transItem = await page.$('button:has-text("L&T Transportation Infrastructure Limited")');
      if (transItem) {
        await transItem.click();
        await page.waitForTimeout(1500);
        await snap('15_profile_lnt_transportation');
        console.log('   ✅ Switched active company to L&T Transportation Infrastructure Limited');
      }
    }

    // 17. Tender Detail: MSRDC Cable-Stayed Bridge (₹2,100 Cr) — GO 98%
    await page.goto('http://localhost:5173/bids/bid_msrdc_bridge_2100', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await snap('16_tender_detail_msrdc_bridge');
    await snap('16_tender_detail_msrdc_bridge_full', true);

    // 18. Tender Detail: NCRTC Metro Viaduct (₹1,120 Cr) — GO 99%
    await page.goto('http://localhost:5173/bids/bid_ncrtc_metro_1120', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await snap('17_tender_detail_ncrtc_metro');
    await snap('17_tender_detail_ncrtc_metro_full', true);

    console.log('\n✨ All multi-tenant screenshots captured successfully!');
  } catch (err) {
    console.error('❌ Error during UI screenshot audit:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
