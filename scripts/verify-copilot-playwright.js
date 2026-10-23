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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
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

  // Set Light Mode
  await page.evaluate(() => {
    localStorage.setItem('tenderpulse_theme', 'light');
    document.documentElement.classList.remove('dark');
  });
  await page.waitForTimeout(300);

  // Open Drawer via Ask Copilot floating button
  console.log('3. Opening Copilot Drawer...');
  await page.click('button[title="Open Tender AI Copilot"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '01_drawer_light_empty.png') });

  // Test real message interaction
  console.log('4. Testing live message sending...');
  const textarea = await page.$('textarea[placeholder*="Ask anything"]');
  if (textarea) {
    await textarea.fill('What is our 3-year average turnover according to our CA certificate?');
    await page.click('button[title="Send message"]');
    // Wait for response
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(outDir, '02_drawer_live_response.png') });
  }

  await browser.close();
  console.log('Done test run!');
}

main().catch(console.error);
