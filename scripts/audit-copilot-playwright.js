import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../playwright-screenshots/copilot');

async function main() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  
  // -------------------------------------------------------------
  // DESKTOP RUN (1440x900)
  // -------------------------------------------------------------
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // HiDPI for crisp screenshot analysis
  });
  const page = await context.newPage();

  console.log('1. Logging in as admin@ashokabuildcon.com...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('#email', 'admin@ashokabuildcon.com');
  await page.fill('#password', 'AshokaBuildcon2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/bids', { timeout: 10000 });

  console.log('2. Navigating to NHAI HAM bid detail page...');
  await page.goto('http://localhost:5173/bids/bid_nhai_ham_850', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Set Light Theme
  await page.evaluate(() => {
    localStorage.setItem('tenderpulse_theme', 'light');
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  });
  await page.waitForTimeout(400);

  // 1. Floating Copilot button visible
  await page.screenshot({ path: path.join(outDir, '01_desktop_bid_detail_floating_trigger.png') });
  console.log('Saved 01_desktop_bid_detail_floating_trigger.png');

  // 2. Open Copilot Drawer
  console.log('Opening Copilot Drawer...');
  await page.click('button[title="Open Tender AI Copilot"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '02_desktop_drawer_light_empty.png') });
  console.log('Saved 02_desktop_drawer_light_empty.png');

  // 3. Send question to get financial qualification response
  console.log('Sending message to Copilot...');
  const textarea = await page.$('textarea[placeholder*="Ask anything"]');
  await textarea.fill('What is our 3-year average turnover according to our CA certificate?');
  await page.click('button[title="Send message"]');
  await page.waitForTimeout(4500);

  // Capture active chat with Markdown, Financial Card, and Citations Bar
  await page.screenshot({ path: path.join(outDir, '03_desktop_drawer_light_conversation.png') });
  console.log('Saved 03_desktop_drawer_light_conversation.png');

  // 4. Click Grounded Source Citation [1] (Tender Document)
  console.log('Clicking citation pill [1]...');
  const citPill1 = await page.$('button:has-text("NIT_Document.pdf")');
  if (citPill1) {
    await citPill1.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, '04_desktop_modal_tender_provenance.png') });
    console.log('Saved 04_desktop_modal_tender_provenance.png');

    // Test Escape key closes modal while keeping drawer open
    console.log('Testing Escape key isolation (modal should close, drawer should stay open)...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    const drawerVisibleAfterEscape = await page.isVisible('span:has-text("Tender AI Copilot")');
    console.log('Drawer still open after Escape:', drawerVisibleAfterEscape);
    await page.screenshot({ path: path.join(outDir, '05_desktop_drawer_retained_after_escape.png') });
  }

  // 5. Click Citation Pill [2] (Company Evidence Vault)
  console.log('Clicking citation pill [2]...');
  const citPill2 = await page.$('button:has-text("CA_Turnover")');
  if (citPill2) {
    await citPill2.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, '06_desktop_modal_company_vault.png') });
    console.log('Saved 06_desktop_modal_company_vault.png');

    // Close modal via close button
    await page.click('div[role="dialog"] button[aria-label="Close"]');
    await page.waitForTimeout(400);
  }

  // 6. Test Copy UDIN button
  console.log('Testing Copy UDIN...');
  const copyBtn = await page.$('button[title="Copy UDIN"]');
  if (copyBtn) {
    await copyBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, '07_desktop_udin_copied_state.png') });
    console.log('Saved 07_desktop_udin_copied_state.png');
  }

  // 7. Dark Mode Verification
  console.log('Switching to Dark Mode...');
  await page.evaluate(() => {
    localStorage.setItem('tenderpulse_theme', 'dark');
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '08_desktop_drawer_dark_conversation.png') });
  console.log('Saved 08_desktop_drawer_dark_conversation.png');

  // Open Citation modal in Dark Mode
  const citDark = await page.$('button:has-text("NIT_Document.pdf")');
  if (citDark) {
    await citDark.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '09_desktop_modal_dark_mode.png') });
    console.log('Saved 09_desktop_modal_dark_mode.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // -------------------------------------------------------------
  // MOBILE VIEWPORT RUN (390x844 - iPhone 14)
  // -------------------------------------------------------------
  console.log('\n--- Mobile Viewport Verification (390x844) ---');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);

  // Capture mobile drawer open state
  await page.screenshot({ path: path.join(outDir, '10_mobile_drawer_open.png') });
  console.log('Saved 10_mobile_drawer_open.png');

  await browser.close();
  console.log('\n✅ All Playwright layout and visual verifications complete!');
}

main().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
