import { chromium } from 'playwright';

async function testToggle() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:5173/login');
  await page.fill('#email', 'bidmanager@acme.com');
  await page.fill('#password', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/bids');
  await page.waitForTimeout(1000);

  const initialClass = await page.evaluate(() => document.documentElement.className);
  console.log('Initial html class on /bids:', initialClass);

  // Find theme toggle button in header
  const toggleBtn = await page.$('header button[aria-label*="mode"]');
  console.log('Toggle button found:', !!toggleBtn);
  if (toggleBtn) {
    const textBefore = await toggleBtn.innerText();
    console.log('Button text before click:', textBefore);
    await toggleBtn.click();
    await page.waitForTimeout(500);

    const classAfter = await page.evaluate(() => document.documentElement.className);
    const textAfter = await toggleBtn.innerText();
    const stored = await page.evaluate(() => localStorage.getItem('tenderpulse_theme'));
    console.log('After click 1: html class =', classAfter, '| button text =', textAfter, '| stored =', stored);

    const styles = await page.evaluate(() => {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const bodyColor = window.getComputedStyle(document.body).color;
      const card = document.querySelector('.bg-card');
      const cardBg = card ? window.getComputedStyle(card).backgroundColor : null;
      return { bodyBg, bodyColor, cardBg };
    });
    console.log('Computed styles in dark:', styles);

    // Refresh the page to see if dark mode persists!
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const classAfterReload = await page.evaluate(() => document.documentElement.className);
    const textAfterReload = await toggleBtn.innerText();
    console.log('After reload: html class =', classAfterReload, '| button text =', textAfterReload);
  }

  await browser.close();
}

testToggle().catch(console.error);
