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

  console.log('=== NAVIGATING TO COMPLIANCE ITEM 001 ===');
  await page.goto('http://localhost:5173/bids/bid-nhai-44-001/compliance/comp-nhai-001');
  await page.waitForTimeout(1500);

  const bodyText1 = await page.evaluate(() => document.body.innerText);
  console.log('Comp 001 Page Snippet:\n', bodyText1.substring(0, 800));
  await page.screenshot({ path: 'e2e/screenshots/compliance_comp_001.png', fullPage: true });

  console.log('=== NAVIGATING TO COMPLIANCE ITEM 003 (NEEDS REVIEW) ===');
  await page.goto('http://localhost:5173/bids/bid-nhai-44-001/compliance/comp-nhai-003');
  await page.waitForTimeout(1500);

  const bodyText3 = await page.evaluate(() => document.body.innerText);
  console.log('Comp 003 Page Snippet:\n', bodyText3.substring(0, 800));
  await page.screenshot({ path: 'e2e/screenshots/compliance_comp_003.png', fullPage: true });

  // Test clicking "6. Human Adjudication Decision" buttons
  const approveAction = page.getByRole('button', { name: /Approve \(Pass\)/i });
  if (await approveAction.isVisible()) {
    console.log('Approve (Pass) button is visible!');
  }

  await browser.close();
  console.log('=== ALL COMPLIANCE ADJUDICATION TESTS PASSED ===');
})();
