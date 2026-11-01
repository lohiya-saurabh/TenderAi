import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../playwright-screenshots/copilot');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('#email', 'admin@ashokabuildcon.com');
  await page.fill('#password', 'AshokaBuildcon2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/bids', { timeout: 10000 });

  await page.goto('http://localhost:5173/bids/bid_nhai_ham_850', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Open Drawer
  await page.click('button[title="Open Tender AI Copilot"]');
  await page.waitForTimeout(500);

  // Send message
  const textarea = await page.$('textarea[placeholder*="Ask anything"]');
  await textarea.fill('What is our 3-year average turnover according to our CA certificate?');
  await page.click('button[title="Send message"]');
  await page.waitForTimeout(4000);

  // Click on citation pill [1] in the Grounded Source Citations section
  console.log('Clicking citation source pill...');
  const citPill = await page.$('button:has-text("NIT_Document.pdf")');
  if (citPill) {
    await citPill.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, '03_citation_modal_tender.png') });
    console.log('Saved 03_citation_modal_tender.png');

    // Close modal
    const closeBtn = await page.$('div[role="dialog"] button[aria-label="Close"]');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(400);
  }

  // Click on citation pill [2] CA Turnover Certificate
  const compCitPill = await page.$('button:has-text("CA_Turnover")');
  if (compCitPill) {
    await compCitPill.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, '04_citation_modal_company.png') });
    console.log('Saved 04_citation_modal_company.png');

    // Close modal via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Test Dark Mode
  console.log('Testing Dark Mode...');
  await page.evaluate(() => {
    localStorage.setItem('tenderpulse_theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '05_drawer_dark_mode.png') });

  // Open Citation Modal in Dark Mode
  const citDark = await page.$('button:has-text("NIT_Document.pdf")');
  if (citDark) {
    await citDark.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '06_citation_modal_dark.png') });
  }

  await browser.close();
  console.log('All modal & dark mode captures done!');
}

main().catch(console.error);
