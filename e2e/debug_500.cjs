const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', async resp => {
    if (resp.status() >= 400) {
      console.log('500 ERROR URL:', resp.url());
      try {
        const body = await resp.text();
        console.log('ERROR BODY:', body);
      } catch (e) {}
    }
  });

  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(2000);
  await browser.close();
})();
