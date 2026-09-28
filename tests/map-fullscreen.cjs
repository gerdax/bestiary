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
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobilePage = await mobileContext.newPage();
    mobilePage.on('pageerror', error => errors.push(error.message));
    await mobilePage.goto(process.env.BASE_URL || 'http://localhost:8765');
    await mobilePage.locator('[data-tab="map"]').click();
    await mobilePage.evaluate(() => {
      OneRingStore.addEnemy({ name: 'Strażnik dotykowy' });
      OneRingStore.setMap(OneRingMap.generateTerrain('ruins', 'medium', 'fullscreen-touch'));
    });
    const mobileSaved = await mobilePage.evaluate(() => OneRingStore.exportBackup());
    await mobilePage.locator('#map-viewport').scrollIntoViewIfNeeded();
    const cdp = await mobileContext.newCDPSession(mobilePage);
    const touch = async (type, touchPoints) => {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
      await mobilePage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const pinch = async (canceled = false) => {
      const viewport = await mobilePage.locator('#map-viewport').boundingBox();
      const point = (x, id) => ({ x: viewport.x + x, y: viewport.y + 130, id });
      await touch('touchStart', [point(85, 1)]);
      await touch('touchStart', [point(85, 1), point(220, 2)]);
      await touch('touchMove', [point(65, 1), point(240, 2)]);
      await touch(canceled ? 'touchCancel' : 'touchEnd', []);
    };
    const mobileButton = mobilePage.locator('#map-fullscreen');
    await pinch();
    const trailingClickBlocked = await mobilePage.locator('.map-token').first().evaluate(node => {
      let reachedToken = false;
      node.addEventListener('click', () => { reachedToken = true; }, { once: true });
      const click = new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'touch' });
      node.dispatchEvent(click);
      return click.defaultPrevented && !reachedToken;
    });
    assert.equal(trailingClickBlocked, true, 'a gesture must suppress its trailing touch click');
    await mobileButton.tap();
    assert.equal(await mobileButton.getAttribute('aria-pressed'), 'true', 'fullscreen tap after pinch');
    await pinch();
    const zoom = () => mobilePage.locator('#map-stage').evaluate(node => new DOMMatrix(node.style.transform).a);
    const zoomBefore = await zoom();
    await mobilePage.locator('#map-zoom-in').tap();
    assert.ok(await zoom() > zoomBefore, 'zoom control tap after pinch');
    await pinch();
    await mobileButton.tap();
    assert.equal(await mobileButton.getAttribute('aria-pressed'), 'false', 'fullscreen exit tap after pinch');
    await pinch(true);
    const zoomAfterCancel = await zoom();
    await mobilePage.locator('#map-zoom-out').tap();
    assert.ok(await zoom() < zoomAfterCancel, 'zoom control tap after canceled pinch');
    assert.deepEqual(await mobilePage.evaluate(() => OneRingStore.exportBackup()), mobileSaved);
    await pinch();
    await mobilePage.evaluate(() => OneRingStore.clearEncounter());
    await mobileButton.tap();
    assert.equal(await mobileButton.getAttribute('aria-pressed'), 'true', 'empty-map fullscreen tap after pinch');
    await mobileButton.tap();
    assert.equal(await mobileButton.getAttribute('aria-pressed'), 'false', 'empty-map fullscreen exit');
    await mobileContext.close();
    assert.deepEqual(errors, []);
    console.log('Fullscreen passed: empty/populated maps, desktop/mobile bounds, toggle/Escape, pinch then touch controls, gesture click suppression and unchanged saved state.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
