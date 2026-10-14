const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    }
  });

  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      networkErrors.push({ url: resp.url(), status: resp.status() });
    }
  });

  console.log('=== STEP 1: AUTHENTICATION ===');
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(500);

  const emailInput = page.locator('input[type="email"]');
  if (await emailInput.isVisible()) {
    await emailInput.fill('bidmanager@acme.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
  }

  console.log('=== STEP 2: DASHBOARD INSPECTION ===');
  await page.goto('http://localhost:5173/bids');
  await page.waitForTimeout(1500);
  console.log('Current URL:', page.url());
  await page.screenshot({ path: 'e2e/screenshots/1_dashboard.png', fullPage: true });

  console.log('=== STEP 3: BID DETAIL INSPECTION ===');
  await page.goto('http://localhost:5173/bids/bid-nhai-44-001');
  await page.waitForTimeout(1500);
  console.log('Bid Detail URL:', page.url());
  await page.screenshot({ path: 'e2e/screenshots/2_bid_detail.png', fullPage: true });

  console.log('=== STEP 4: COMPLIANCE REVIEW INSPECTION ===');
  await page.goto('http://localhost:5173/bids/bid-nhai-44-001/compliance');
  await page.waitForTimeout(1500);
  console.log('Direct Compliance URL:', page.url());
  await page.screenshot({ path: 'e2e/screenshots/4_compliance_review.png', fullPage: true });

  console.log('=== STEP 5: COMPANY PROFILE TABS INSPECTION ===');
  await page.goto('http://localhost:5173/company-profile');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/5_company_profile_tabs.png', fullPage: true });

  console.log('\n=== CONSOLE LOGS ===');
  console.log(JSON.stringify(consoleLogs, null, 2));

  console.log('\n=== NETWORK ERRORS (4xx/5xx) ===');
  console.log(JSON.stringify(networkErrors, null, 2));

  await browser.close();
  console.log('=== ALL STEPS COMPLETED ===');
})();
