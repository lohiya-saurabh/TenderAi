import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../playwright-screenshots/copilot');

async function run() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log('1. Navigating to login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.fill('#email', 'admin@ashokabuildcon.com');
  await page.fill('#password', 'AshokaBuildcon2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/bids', { timeout: 10000 });
  console.log('2. Logged in successfully. Current URL:', page.url());

  // Navigate to bid detail
  await page.goto('http://localhost:5173/bids/bid_nhai_ham_850', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log('3. Navigated to bid_nhai_ham_850');

  // Capture bid page with floating Ask Copilot button
  await page.screenshot({ path: path.join(outDir, '01_bid_detail_floating_copilot.png') });

  // Click "Ask Copilot" floating button
  const askCopilotBtn = await page.$('button[title="Open Tender AI Copilot"]');
  if (askCopilotBtn) {
    console.log('4. Clicking Ask Copilot button...');
    await askCopilotBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '02_drawer_empty_initial.png') });
  } else {
    console.log('Floating button not found! Trying top header button...');
    const topCopilotBtn = await page.$('button:has-text("AI Copilot")');
    if (topCopilotBtn) {
      await topCopilotBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, '02_drawer_empty_initial.png') });
    }
  }

  await browser.close();
  console.log('Initial capture complete!');
}

run().catch((err) => {
  console.error('Error running playwright capture:', err);
  process.exit(1);
});
