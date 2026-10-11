import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const outDir = path.resolve(__dirname, '../playwright-screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log('Capturing screenshots of all real pages in Light Mode...');

  // 1. Landing Page
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.evaluate(() => {
      localStorage.setItem('tenderpulse_theme', 'light');
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '01_landing.png') });
    await page.screenshot({ path: path.join(outDir, '01_landing_full.png'), fullPage: true });
    console.log('Saved 01_landing.png and full page');
  } catch (e) {
    console.error('Error on landing:', e.message);
  }

  // 2. Pricing Page
  try {
    await page.goto('http://localhost:5173/pricing', { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, '02_pricing.png') });
    await page.screenshot({ path: path.join(outDir, '02_pricing_full.png'), fullPage: true });
    console.log('Saved 02_pricing.png and full page');
  } catch (e) {
    console.error('Error on pricing:', e.message);
  }

  // 3. Login Page & Authenticate with real user
  try {
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, '03_login.png') });
    console.log('Saved 03_login.png');

    // Perform Login
    await page.fill('#email', 'bidmanager@acme.com');
    await page.fill('#password', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/bids', { timeout: 10000 });
    await page.waitForTimeout(1500);
    console.log('Logged in as bidmanager@acme.com and navigated to /bids successfully!');
  } catch (e) {
    console.error('Error on login:', e.message);
  }

  // 4. Dashboard Page
  try {
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '04_dashboard.png') });
    await page.screenshot({ path: path.join(outDir, '04_dashboard_full.png'), fullPage: true });
    console.log('Saved 04_dashboard.png and full page');
  } catch (e) {
    console.error('Error on dashboard:', e.message);
  }

  // 5. Create Bid Page
  try {
    await page.click('a[href="/bids/new"]');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '05_create_bid.png') });
    await page.screenshot({ path: path.join(outDir, '05_create_bid_full.png'), fullPage: true });
    console.log('Saved 05_create_bid.png and full page');
  } catch (e) {
    console.error('Error on create bid:', e.message);
  }

  // 6. Real Bid Detail Page
  try {
    await page.goto('http://localhost:5173/bids/bid-nhai-44-001', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, '06_bid_detail.png') });
    await page.screenshot({ path: path.join(outDir, '06_bid_detail_full.png'), fullPage: true });
    console.log('Saved 06_bid_detail.png and full page');

    // Focused capture of Section 5: Extracted Compliance Matrix
    const complianceSection = await page.$('#compliance-matrix');
    if (complianceSection) {
      await complianceSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await complianceSection.screenshot({ path: path.join(outDir, '06_section5_compliance_matrix.png') });
      console.log('Saved 06_section5_compliance_matrix.png');

      // Click the first row expand button
      const expandBtn = await page.$('button[aria-label="Expand row"]');
      if (expandBtn) {
        await expandBtn.click();
        await page.waitForTimeout(600);
        await complianceSection.screenshot({ path: path.join(outDir, '06_section5_compliance_matrix_expanded.png') });
        console.log('Saved 06_section5_compliance_matrix_expanded.png');
      }
    }
  } catch (e) {
    console.error('Error on bid detail:', e.message);
  }

  // 7. Compliance Review Page
  try {
    await page.goto('http://localhost:5173/bids/bid-nhai-44-001/compliance/comp-nhai-001', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, '07_compliance_review.png') });
    await page.screenshot({ path: path.join(outDir, '07_compliance_review_full.png'), fullPage: true });
    console.log('Saved 07_compliance_review.png and full page');
  } catch (e) {
    console.error('Error on compliance review:', e.message);
  }

  // 8. Audit History Page
  try {
    await page.goto('http://localhost:5173/bids/bid-nhai-44-001/audit', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '08_audit_history.png') });
    await page.screenshot({ path: path.join(outDir, '08_audit_history_full.png'), fullPage: true });
    console.log('Saved 08_audit_history.png and full page');
  } catch (e) {
    console.error('Error on audit history:', e.message);
  }

  // 9. Company Profile Page
  try {
    await page.goto('http://localhost:5173/company-profile', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, '09_company_profile.png') });
    await page.screenshot({ path: path.join(outDir, '09_company_profile_full.png'), fullPage: true });
    console.log('Saved 09_company_profile.png and full page');
  } catch (e) {
    console.error('Error on company profile:', e.message);
  }

  // 10. Settings Page
  try {
    await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '10_settings.png') });
    await page.screenshot({ path: path.join(outDir, '10_settings_full.png'), fullPage: true });
    console.log('Saved 10_settings.png and full page');
  } catch (e) {
    console.error('Error on settings:', e.message);
  }

  await browser.close();
  console.log('Done! All screenshots captured.');
}

main().catch(console.error);
