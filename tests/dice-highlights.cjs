const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.BASE_URL || 'http://localhost:8765');
    await page.locator('.dice-launch').click();
    await page.locator('[data-choice="baseDice"] [data-value="3"]').click();
    const cases = [
      ['hero', 'normal', false, [7], 0, 0],
      ['hero', 'normal', true, [12], 1, 0],
      ['enemy', 'normal', false, [11], 1, 0],
      ['hero', 'normal', false, [11], 0, 0],
      ['enemy', 'normal', false, [12], 0, 0],
      ['hero', 'favoured', true, [7, 12], 1, 1],
      ['enemy', 'favoured', false, [7, 11], 1, 1],
      ['hero', 'weary', true, [7, 12], 0, 1],
      ['enemy', 'weary', false, [7, 11], 0, 1],
      ['hero', 'favoured', false, [2, 7], 0, 1]
    ];
    for (const [actor, mode, exhausted, feat, successes, unused] of cases) {
      await page.locator(`[data-choice="actor"] [data-value="${actor}"]`).click();
      await page.locator(`[data-choice="featMode"] [data-value="${mode}"]`).click();
      await page.locator('[data-check="exhausted"]').setChecked(exhausted);
      await page.evaluate(feat => { window.DiceEngine = { roll: async () => ({ feat, success: [2, 4, 6] }), clear() {} }; }, feat);
      await page.locator('.dice-roll').click();
      await page.locator('.dice-result:not([hidden])').waitFor();
      const rows = page.locator('.dice-result-row');
      assert.equal(await rows.nth(0).locator('.is-success').count(), successes);
      assert.equal(await rows.nth(0).locator('.is-unused').count(), unused);
      assert.equal(await rows.nth(1).locator('.is-success').count(), 1);
      assert.equal(await rows.nth(1).locator('.is-success').innerText(), '6');
      assert.equal(await rows.nth(1).locator('.is-unused').count(), exhausted ? 1 : 0);
      assert.equal(await page.locator('.is-unused.is-success').count(), 0);
      await page.locator('.dice-again').click();
    }
    console.log('Success-only outlines and unused dice verified in 10 roll combinations.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
