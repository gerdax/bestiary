const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8765');
    await page.locator('[data-tab="map"]').click();
    const id = await page.evaluate(() => {
      const enemy = OneRingStore.addEnemy({ name: 'Dotykowy Ork', might: 1 });
      OneRingStore.setMap(OneRingMap.generateTerrain('clearing', 'medium', 'touch-gesture'));
      OneRingStore.moveToken(enemy.id, 600, 600);
      return enemy.id;
    });
    await page.locator('#map-fit').click();
    const cdp = await context.newCDPSession(page);
    const viewport = await page.locator('#map-viewport').boundingBox();
    const point = (x, y, id) => ({ x: viewport.x + x, y: viewport.y + y, id });
    const touch = async (type, points) => {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const view = () => page.evaluate(() => {
      const matrix = new DOMMatrix(document.querySelector('#map-stage').style.transform);
      return { x: matrix.e, y: matrix.f, zoom: matrix.a, state: localStorage.getItem('one-ring-state') };
    });
    const initial = await view();

    // One finger on terrain does not move the map.
    await touch('touchStart', [point(75, 100, 1)]);
    await touch('touchMove', [point(115, 125, 1)]);
    assert.deepEqual(await view(), initial);
    await touch('touchEnd', []);

    // Two fingers translate, then pinch around the moving midpoint.
    await touch('touchStart', [point(75, 100, 2)]);
    await touch('touchStart', [point(75, 100, 2), point(225, 100, 3)]);
    await touch('touchMove', [point(95, 130, 2), point(245, 130, 3)]);
    const panned = await view();
    assert.ok(Math.abs(panned.x - initial.x - 20) < .1, JSON.stringify({ initial, panned }));
    assert.ok(Math.abs(panned.y - initial.y - 30) < .1);
    assert.ok(Math.abs(panned.zoom - initial.zoom) < .001);
    await touch('touchMove', [point(55, 130, 2), point(285, 130, 3)]);
    const pinched = await view();
    assert.ok(pinched.zoom > panned.zoom * 1.5, JSON.stringify({ before: panned.zoom, after: pinched.zoom }));
    const border = await page.locator('#map-viewport').evaluate(node => ({ x: node.clientLeft, y: node.clientTop }));
    const anchorBefore = { x: (150 - border.x - initial.x) / initial.zoom, y: (100 - border.y - initial.y) / initial.zoom };
    assert.ok(Math.abs((170 - border.x - pinched.x) / pinched.zoom - anchorBefore.x) < 1);
    assert.ok(Math.abs((130 - border.y - pinched.y) / pinched.zoom - anchorBefore.y) < 1);
    assert.equal(pinched.state, initial.state);

    // Lifting one finger locks the remaining finger until the next gesture.
    await touch('touchEnd', [point(55, 130, 2)]);
    await touch('touchMove', [point(140, 185, 2)]);
    assert.deepEqual(await view(), pinched);
    await touch('touchEnd', []);

    // A third finger stops the gesture, and the two remaining fingers stay locked.
    await touch('touchStart', [point(75, 100, 7)]);
    await touch('touchStart', [point(75, 100, 7), point(225, 100, 8)]);
    const beforeThird = await view();
    await touch('touchStart', [point(75, 100, 7), point(225, 100, 8), point(150, 170, 9)]);
    await touch('touchMove', [point(40, 100, 7), point(260, 100, 8), point(150, 170, 9)]);
    await touch('touchEnd', [point(40, 100, 7), point(260, 100, 8)]);
    await touch('touchMove', [point(60, 120, 7), point(280, 120, 8)]);
    assert.deepEqual(await view(), beforeThird);
    await touch('touchEnd', []);

    // Start a token drag, add another finger, and verify the pending move is undone.
    await page.locator('#map-fit').click();
    const token = page.locator(`.map-token[data-id="${id}"]`);
    const tokenBox = await token.boundingBox();
    const center = { x: tokenBox.x + tokenBox.width / 2, y: tokenBox.y + tokenBox.height / 2 };
    const stored = await page.evaluate(() => localStorage.getItem('one-ring-state'));
    const originalPos = await token.evaluate(node => ({ left: node.style.left, top: node.style.top }));
    await touch('touchStart', [{ ...center, id: 4 }]);
    await touch('touchMove', [{ x: center.x + 35, y: center.y + 20, id: 4 }]);
    const dragged = await token.evaluate(node => ({ left: node.style.left, top: node.style.top }));
    assert.notDeepEqual(dragged, originalPos);
    await touch('touchStart', [{ x: center.x + 35, y: center.y + 20, id: 4 }, point(80, 100, 5)]);
    assert.deepEqual(await token.evaluate(node => ({ left: node.style.left, top: node.style.top })), originalPos);
    await touch('touchMove', [{ x: center.x + 50, y: center.y + 20, id: 4 }, point(70, 100, 5)]);
    await touch('touchCancel', []);
    assert.equal(await page.evaluate(() => localStorage.getItem('one-ring-state')), stored);
    assert.deepEqual(await token.evaluate(node => ({ left: node.style.left, top: node.style.top })), originalPos);

    // A fresh one-finger token drag still commits after cancellation.
    const freshBox = await token.boundingBox();
    const fresh = { x: freshBox.x + freshBox.width / 2, y: freshBox.y + freshBox.height / 2 };
    await touch('touchStart', [{ ...fresh, id: 6 }]);
    await touch('touchMove', [{ x: fresh.x + 35, y: fresh.y + 20, id: 6 }]);
    await touch('touchEnd', []);
    assert.notEqual(await page.evaluate(() => localStorage.getItem('one-ring-state')), stored);
    assert.deepEqual(errors, []);
    console.log('Map touch passed: one-finger terrain, pan/pinch anchor, release lock, canceled token drag, fresh token drag.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
