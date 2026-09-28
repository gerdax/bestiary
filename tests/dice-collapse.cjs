const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const width of [1200, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(process.env.BASE_URL || 'http://localhost:8765');
      await page.evaluate(() => { window.DiceEngine = { roll: () => new Promise(resolve => { window.finishDice = resolve; }), clear() {} }; });
      await page.locator('.dice-launch').click();
      const toggle = page.locator('.dice-collapse');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      await page.locator('[data-choice="baseDice"] [data-value="2"]').click();
      const expanded = await page.locator('.dice-sheet').evaluate(n => n.offsetHeight);
      const scale = await page.locator('#dice-stage').getAttribute('data-visual-scale');
      await toggle.click();
      assert.equal(await page.locator('#dice-settings').isVisible(), false);
      assert.ok(await page.locator('.dice-sheet').evaluate(n => n.offsetHeight) < expanded - 150);
      assert.equal(await page.locator('#dice-stage').getAttribute('data-visual-scale'), scale);
      assert.match(await page.locator('.dice-pool').innerText(), /2 × kość sukcesu/);
      await page.screenshot({ path: `/tmp/dice-compact-${width}.png` });
      await page.locator('.dice-roll').click();
      assert.equal(await toggle.isDisabled(), true);
      await page.evaluate(() => finishDice({ feat: [7], success: [3, 6] }));
      await page.locator('.dice-result:not([hidden])').waitFor();
      assert.equal(await toggle.isVisible(), false);
      await page.locator('.dice-again').click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      await toggle.click();
      await page.locator('.dice-roll').click();
      await page.evaluate(() => finishDice({ feat: [8], success: [4, 5] }));
      await page.locator('.dice-result:not([hidden])').waitFor();
      await page.locator('.dice-again').click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      await toggle.click();
      await page.keyboard.press('Escape');
      await page.locator('.dice-launch').click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('[data-choice="baseDice"] [data-value="2"]').getAttribute('aria-pressed'), 'true');
      await page.locator('[data-target]').fill('-1');
      await toggle.click();
      await page.locator('.dice-roll').click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('.dice-result').isVisible(), false);
      await page.close();
    }
    console.log('Compact setup: state across rolls, reopen reset, unchanged scale, invalid PT and mobile passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
