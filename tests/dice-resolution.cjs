const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const dpr of [1, 2, 3]) {
      const context = await browser.newContext({ viewport: { width: 900, height: 800 }, deviceScaleFactor: dpr });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.BASE_URL || 'http://localhost:8765');
      await page.locator('.dice-launch').click();
      await page.locator('[data-choice="baseDice"] [data-value="3"]').click();
      await page.locator('.dice-roll').click();
      await page.locator('.dice-result:not([hidden])').waitFor({ timeout: 30000 });
      async function checkBuffer() {
        await page.waitForFunction(() => {
          const c = document.querySelector('#dice-stage canvas');
          return c.width === Math.round(c.clientWidth * devicePixelRatio) && c.height === Math.round(c.clientHeight * devicePixelRatio);
        });
        return page.locator('#dice-stage canvas').evaluate(c => ({ css: [c.clientWidth, c.clientHeight], buffer: [c.width, c.height] }));
      }
      console.log(`DPR ${dpr}:`, await checkBuffer());
      await page.screenshot({ path: `/tmp/dice-sharp-dpr-${dpr}.png` });
      await page.setViewportSize({ width: 658, height: 839 });
      await checkBuffer();
      await page.locator('.dice-again').click();
      await page.locator('[data-choice="actor"] [data-value="enemy"]').click();
      await page.locator('.dice-roll').click();
      await page.locator('.dice-result:not([hidden])').waitFor({ timeout: 30000 });
      await checkBuffer();
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('Native resolution, resize and repeated hero/enemy rolls passed at DPR 1/2/3.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
