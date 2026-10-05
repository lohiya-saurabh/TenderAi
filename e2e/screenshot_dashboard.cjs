const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', 'bidmanager@acme.com');
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');

  console.log('Waiting for dashboard...');
  await page.waitForURL('**/bids', { timeout: 10000 });
  await page.waitForTimeout(1500);

  console.log('Taking screenshot...');
  await page.screenshot({ path: 'e2e/screenshots/dashboard_styled.png', fullPage: true });

  console.log('Done screenshot saved to e2e/screenshots/dashboard_styled.png');
  await browser.close();
})();
