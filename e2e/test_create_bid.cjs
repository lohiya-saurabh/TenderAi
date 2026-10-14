const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('=== LOGGING IN ===');
  await page.goto('http://localhost:5173');
  await page.fill('input[type="email"]', 'bidmanager@acme.com');
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);

  console.log('=== NAVIGATING TO NEW BID CREATION ===');
  await page.goto('http://localhost:5173/bids/new');
  await page.waitForTimeout(1000);

  // Fill in form inputs accurately using exact placeholder selectors
  await page
    .locator('input[placeholder*="Supply and Commissioning"]')
    .fill('Four-Laning of NH-66 Coastal Highway Package IV');
  await page.locator('input[placeholder*="NTPC/2026/SOLAR"]').fill('NHAI/MUM/2026/EPC-0891');
  await page
    .locator('input[placeholder*="NTPC Limited"]')
    .fill('National Highways Authority of India');
  await page.locator('input[placeholder*="50000000"]').fill('3200000000');

  const submitBtn = page.getByRole('button', { name: /Create Bid Project/i });
  console.log('Submitting new bid form...');
  await submitBtn.click();
  await page.waitForTimeout(2000);

  console.log('After creation URL:', page.url());
  const headerText = await page.evaluate(() => document.body.innerText);
  console.log('Created Bid Page Content Snippet:\n', headerText.substring(0, 500));

  await page.screenshot({ path: 'e2e/screenshots/created_new_bid_success.png', fullPage: true });

  await browser.close();
  console.log('=== CREATE BID E2E TEST COMPLETED SUCCESSFULLY ===');
})();
