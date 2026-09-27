const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.BASE_URL || 'http://localhost:8765');
    await page.locator('[data-tab="map"]').click();
    const button = page.locator('#map-fullscreen');
    // Empty maps can expand too.
    await button.click(); await page.keyboard.press('Escape');
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
    await page.evaluate(() => {
      OneRingStore.addEnemy({ name: 'Strażnik' });
      OneRingStore.setMap(OneRingMap.generateTerrain('ruins', 'medium', 'fullscreen'));
    });
    const saved = await page.evaluate(() => OneRingStore.exportBackup());
    for (const size of [{width:1280,height:900},{width:390,height:844}]) {
      await page.setViewportSize(size);
      await button.click();
      const bounds = await page.locator('#map-viewport').boundingBox();
      assert.deepEqual(bounds, {x:0,y:0,...size});
      assert.equal(await page.locator('.map-heading').evaluate(node => node.inert), true);
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      await page.locator('#map-zoom-in').click();
      await page.locator('#map-fit').click();
      assert.equal(await page.locator('.map-token').count(), 1);
      await page.screenshot({path:`/tmp/map-fullscreen-${size.width}.png`});
      await button.click();
      assert.equal(await page.locator('.map-heading').evaluate(node => node.inert), false);
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      await button.click(); await page.keyboard.press('Escape');
      assert.equal(await button.getAttribute('aria-pressed'), 'false');
      assert.deepEqual(await page.evaluate(() => OneRingStore.exportBackup()), saved);
    }
    assert.deepEqual(errors, []);
    console.log('Fullscreen passed: empty/populated maps, desktop/mobile bounds, toggle/Escape, controls and unchanged saved state.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
