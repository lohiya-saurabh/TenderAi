const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText));
  page.on('response', res => {
    if (res.status() >= 400) {
      console.log('RESPONSE ERROR:', res.status(), res.url());
    }
  });

  console.log('Navigating to /login...');
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(2000);

  const html = await page.content();
  console.log('PAGE HTML SNIPPET:', html.slice(0, 500));

  await browser.close();
})();
