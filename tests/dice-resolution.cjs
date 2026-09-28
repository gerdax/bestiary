const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const dpr of [1, 2, 3]) {
      const context = await browser.newContext({ viewport: { width: 900, height: 800 }, deviceScaleFactor: dpr, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const world = fs.readFileSync(path.join(__dirname, '../vendor/dice-box/world.onscreen.js'), 'utf8');
      await page.route('**/world.onscreen.js', route => route.fulfill({ contentType: 'text/javascript', body: world.replace('t.themeData = {};', 't.themeData = {}; window.testDiceScene = t;') }));
      await page.goto(process.env.BASE_URL || 'http://localhost:8765');
      await page.locator('.dice-launch').click();
      await page.locator('[data-choice="baseDice"] [data-value="3"]').click();
      await page.locator('.dice-roll').click();
      await page.locator('.dice-result:not([hidden])').waitFor({ timeout: 30000 });
      async function checkBuffer() {
        await page.waitForFunction(() => {
          const c = document.querySelector('#dice-stage canvas');
          return c.width === Math.floor(c.clientWidth * Math.min(devicePixelRatio, 1.5)) && c.height === Math.floor(c.clientHeight * Math.min(devicePixelRatio, 1.5));
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
      // Allow the old optimizer's two-second sampling interval to elapse.
      await page.waitForTimeout(2200);
      assert.equal(await page.evaluate(() => testDiceScene.shadowsEnabled), true);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('Bounded Retina resolution, resize and repeated hero/enemy rolls passed at DPR 1/2/3.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
