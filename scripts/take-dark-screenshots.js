import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const outDir = path.resolve(__dirname, '../playwright-screenshots/dark');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log('Capturing screenshots of all pages in DARK MODE...');

  // Set theme to dark in localStorage for this domain
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
  await page.evaluate(() => {
    localStorage.setItem('tenderpulse_theme', 'dark');
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  });

  // 1. Login Page in Dark Mode
  await page.screenshot({ path: path.join(outDir, '03_login_dark.png') });
  console.log('Saved 03_login_dark.png');

  // Perform Login
  await page.fill('#email', 'bidmanager@acme.com');
  await page.fill('#password', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/bids', { timeout: 10000 });
  await page.waitForTimeout(1500);

  // Ensure dark class is still on document.documentElement
  await page.evaluate(() => {
    localStorage.setItem('tenderpulse_theme', 'dark');
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  });
  await page.waitForTimeout(500);

  // 2. Dashboard Page in Dark Mode
  await page.screenshot({ path: path.join(outDir, '04_dashboard_dark.png') });
  await page.screenshot({ path: path.join(outDir, '04_dashboard_full_dark.png'), fullPage: true });
  console.log('Saved 04_dashboard_dark.png');

  // 3. Create Bid Page in Dark Mode
  try {
    await page.goto('http://localhost:5173/bids/new', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '05_create_bid_dark.png') });
    console.log('Saved 05_create_bid_dark.png');
  } catch (e) {
    console.error('Error on create bid:', e.message);
  }

  // 4. Real Bid Detail Page in Dark Mode
  try {
    await page.goto('http://localhost:5173/bids/bid-nhai-44-001', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, '06_bid_detail_dark.png') });
    await page.screenshot({ path: path.join(outDir, '06_bid_detail_full_dark.png'), fullPage: true });
    console.log('Saved 06_bid_detail_dark.png');

    // Section 3: Statutory Execution Rules
    const sec3 = await page.$('text=Statutory Execution Rules');
    if (sec3) {
      await sec3.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outDir, '06_section3_rules_dark.png') });
      console.log('Saved 06_section3_rules_dark.png');
    }

    // Section 5: Compliance Matrix
    const complianceSection = await page.$('#compliance-matrix');
    if (complianceSection) {
      await complianceSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await complianceSection.screenshot({ path: path.join(outDir, '06_section5_compliance_matrix_dark.png') });

      // Click the first row expand button
      const expandBtn = await page.$('button[aria-label="Expand row"]');
      if (expandBtn) {
        await expandBtn.click();
        await page.waitForTimeout(600);
        await complianceSection.screenshot({ path: path.join(outDir, '06_section5_compliance_matrix_expanded_dark.png') });
      }
      console.log('Saved 06_section5_compliance_matrix_dark.png');
    }
  } catch (e) {
    console.error('Error on bid detail:', e.message);
  }

  // 5. Compliance Review Page in Dark Mode
  try {
    await page.goto('http://localhost:5173/bids/bid-nhai-44-001/compliance/comp-nhai-001', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, '07_compliance_review_dark.png') });
    await page.screenshot({ path: path.join(outDir, '07_compliance_review_full_dark.png'), fullPage: true });
    console.log('Saved 07_compliance_review_dark.png');
  } catch (e) {
    console.error('Error on compliance review:', e.message);
  }

  // 6. Audit History Page in Dark Mode
  try {
    await page.goto('http://localhost:5173/bids/bid-nhai-44-001/audit', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '08_audit_history_dark.png') });
    await page.screenshot({ path: path.join(outDir, '08_audit_history_full_dark.png'), fullPage: true });
    console.log('Saved 08_audit_history_dark.png');
  } catch (e) {
    console.error('Error on audit history:', e.message);
  }

  // 7. Company Profile Page in Dark Mode
  try {
    await page.goto('http://localhost:5173/company-profile', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, '09_company_profile_dark.png') });
    await page.screenshot({ path: path.join(outDir, '09_company_profile_full_dark.png'), fullPage: true });
    console.log('Saved 09_company_profile_dark.png');
  } catch (e) {
    console.error('Error on company profile:', e.message);
  }

  // 8. Settings Page in Dark Mode
  try {
    await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '10_settings_dark.png') });
    console.log('Saved 10_settings_dark.png');
  } catch (e) {
    console.error('Error on settings:', e.message);
  }

  // 9. Landing & Pricing Pages in Dark Mode
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '01_landing_dark.png') });
    console.log('Saved 01_landing_dark.png');

    await page.goto('http://localhost:5173/pricing', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '02_pricing_dark.png') });
    console.log('Saved 02_pricing_dark.png');
  } catch (e) {
    console.error('Error on landing/pricing:', e.message);
  }

  await browser.close();
  console.log('All dark mode screenshots captured successfully!');
}

main().catch(console.error);
