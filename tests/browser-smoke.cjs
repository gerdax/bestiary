/* Repeatable browser smoke check. Run with NODE_PATH=<runtime node_modules> node tests/browser-smoke.cjs. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8765';
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const screenshotDir = process.env.SCREENSHOT_DIR || '/tmp';
let browser;

async function main() {
  browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox'] });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [], observerErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && message.text().startsWith('State observer failed')) observerErrors.push(message.text()); });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  assert.equal(await page.title(), 'Bestiariusz Śródziemia');

  // Create and edit a hero; verify duplicate participation is prevented.
  await page.locator('[data-tab="heroes"]').click();
  await page.locator('[data-hero-action="new"]').click();
  await page.locator('#hero-editor input[name="name"]').fill('Eowyn Smoke');
  await page.locator('#hero-editor input[name="culture"]').fill('Rohirrim');
  await page.locator('#hero-editor input[name="maxEndurance"]').fill('22');
  await page.locator('#hero-editor input[name="endurance"]').fill('18');
  await page.locator('#hero-editor input[name="maxHope"]').fill('13');
  await page.locator('#hero-editor input[name="hope"]').fill('11');
  await page.locator('#hero-editor input[name="hope"]').press('Tab');
  const heroTab = page.locator('#hero-list [role="tab"]').filter({ hasText: 'Eowyn Smoke' });
  await assert.doesNotReject(() => heroTab.waitFor());
  await heroTab.click();
  await page.locator('#hero-editor input[name="culture"]').fill('Riddermark');
  await page.locator('#hero-editor input[name="culture"]').dispatchEvent('change');
  await page.locator('#hero-editor [data-hero-action="battle"]').click();
  assert.equal(await page.locator('#hero-battle-list .hero-battle-card').count(), 1);
  assert.equal(await page.locator('#hero-editor [data-hero-action="battle"]').textContent(), 'Usuń z potyczki');
  assert.equal(await page.locator('[data-tab="battle"]').isVisible(), false);
  assert.equal(await page.locator('[data-tab="battle"]').isDisabled(), true);

  // Add the same enemy twice through the generator; the map is the encounter UI.
  await page.locator('[data-tab="generator"]').click();
  await page.locator('#name').fill('Smoke Uruk');
  await page.locator('#enemy-form button[data-action="battle"]').click();
  assert.equal(await page.locator('#map').evaluate(node => node.classList.contains('active')), true);
  await page.locator('[data-tab="generator"]').click();
  await page.locator('#enemy-form button[data-action="battle"]').click();
  assert.equal(await page.locator('#map').evaluate(node => node.classList.contains('active')), true);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('one-ring-state')).battle.length), 2);

  // Generate terrain, then adjust and defeat an enemy through its map panel.
  await page.locator('#map-generate').click();
  assert.equal(await page.locator('.enemy-token').count(), 2);
  const enemyToken = page.locator('.enemy-token').first();
  const enemyId = await enemyToken.getAttribute('data-id');
  await enemyToken.click();
  const enemyEndurance = await page.evaluate(id => JSON.parse(localStorage.getItem('one-ring-state')).battle.find(item => item.id === id).endurance, enemyId);
  await page.locator('#map-panel .map-resource[data-field="endurance"] button').first().click();
  assert.equal(await page.evaluate(id => JSON.parse(localStorage.getItem('one-ring-state')).battle.find(item => item.id === id).endurance, enemyId), enemyEndurance - 1);
  await page.locator('#map-panel .map-panel-action').click();
  assert.equal(await page.locator(`.enemy-token[data-id="${enemyId}"]`).evaluate(node => node.classList.contains('is-defeated')), true);
  assert.equal(await page.locator('#map-panel .map-panel-action').textContent(), 'Przywróć do walki');
  const before = await page.locator('#map-stage').getAttribute('style');
  await page.locator('#map-zoom-in').click();
  assert.notEqual(await page.locator('#map-stage').getAttribute('style'), before);
  await page.screenshot({ path: path.join(screenshotDir, 'one-ring-final-map.png'), fullPage: true });

  const viewport = await page.locator('#map-viewport').boundingBox();
  await page.mouse.move(viewport.x + 30, viewport.y + 30);
  await page.mouse.down();
  await page.mouse.move(viewport.x + 210, viewport.y + 55, { steps: 6 });
  await page.mouse.up();

  // Drag a marker at current zoom, then verify the stored placement survives reload.
  const token = page.locator('.hero-token').first();
  const tokenId = await token.getAttribute('data-id');
  const posBefore = await page.evaluate(id => JSON.parse(localStorage.getItem('one-ring-state')).map.positions[id], tokenId);
  const box = await token.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 82, box.y + box.height / 2 + 54, { steps: 8 });
  await page.mouse.up();
  const posAfter = await page.evaluate(id => JSON.parse(localStorage.getItem('one-ring-state')).map.positions[id], tokenId);
  assert.notDeepEqual(posAfter, posBefore);
  await page.reload({ waitUntil: 'networkidle' });
  assert.deepEqual(await page.evaluate(id => JSON.parse(localStorage.getItem('one-ring-state')).map.positions[id], tokenId), posAfter);

  // Map controls update the same hero sheet after reload.
  await page.locator('[data-tab="map"]').click();
  const heroToken = page.locator('.hero-token').first();
  await heroToken.click();
  assert.match(await page.locator('#map-panel .map-resource[data-field="hope"]').textContent(), /11 \/ 13/);
  const panelBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('one-ring-state')).heroes[0].hope);
  await page.locator('#map-panel .map-resource[data-field="hope"] button').first().click();
  const heroStateAfterPanel = await page.evaluate(() => JSON.parse(localStorage.getItem('one-ring-state')).heroes[0].hope);
  assert.equal(heroStateAfterPanel, panelBefore - 1);
  await page.locator('[data-tab="heroes"]').click();
  assert.equal(await page.locator('#hero-editor input[name="hope"]').inputValue(), String(heroStateAfterPanel));
  await page.locator('[data-tab="map"]').click();
  await page.locator('#map-panel .map-panel-action').click();
  assert.equal(await page.locator('.hero-token').first().evaluate(node => node.classList.contains('is-defeated')), true);

  // Regeneration clears placements while retaining resources.
  const resourceBeforeRegen = await page.evaluate(() => JSON.parse(localStorage.getItem('one-ring-state')).battle[0].hate);
  await page.locator('#map-generate').click();
  const afterRegen = await page.evaluate(() => JSON.parse(localStorage.getItem('one-ring-state')));
  assert.equal(afterRegen.battle[0].hate, resourceBeforeRegen);
  assert.equal(Object.keys(afterRegen.map.positions).length, afterRegen.battle.length + afterRegen.heroParticipants.length);
  // Backup export/import is UI driven; invalid restore must preserve current state.
  const expected = await page.evaluate(() => JSON.parse(localStorage.getItem('one-ring-state')));
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-backup').click()]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  assert.deepEqual(exported, expected);
  const validPath = path.join(screenshotDir, 'one-ring-smoke-backup.json');
  fs.writeFileSync(validPath, JSON.stringify(expected));
  const invalidPath = path.join(screenshotDir, 'one-ring-smoke-invalid.json');
  fs.writeFileSync(invalidPath, JSON.stringify({ version: 2, library: [], battle: [], heroes: [], heroParticipants: [], map: { invalid: true } }));
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-tab="map"]').click();
  await page.locator('#map-clear').click();
  const afterClear = await page.evaluate(() => JSON.parse(localStorage.getItem('one-ring-state')));
  assert.equal(afterClear.heroes.length, 1);
  assert.equal(afterClear.library.length, expected.library.length);
  assert.equal(afterClear.battle.length, 0);
  assert.equal(afterClear.heroParticipants.length, 0);
  assert.equal(afterClear.map, null);
  assert.equal(await page.locator('.map-token').count(), 0);
  await page.locator('#restore-backup').click();
  await page.locator('#backup-file').setInputFiles(validPath);
  await page.waitForFunction(expected => JSON.stringify(JSON.parse(localStorage.getItem('one-ring-state'))) === expected, JSON.stringify(expected));
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('one-ring-state'))), expected);
  const beforeInvalid = await page.evaluate(() => localStorage.getItem('one-ring-state'));
  await page.locator('#restore-backup').click();
  await page.locator('#backup-file').setInputFiles(invalidPath);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => localStorage.getItem('one-ring-state')), beforeInvalid);

  // Legacy storage migration occurs only in a fresh isolated context.
  const legacy = await browser.newContext();
  const legacyPage = await legacy.newPage();
  await legacyPage.goto(baseURL);
  await legacyPage.evaluate(() => {
    localStorage.removeItem('one-ring-state');
    localStorage.setItem('one-ring-library', JSON.stringify([{ name: 'Legacy Warg', kind: 'Bestia', endurance: 8, hate: 4 }]));
  });
  await legacyPage.reload({ waitUntil: 'networkidle' });
  await legacyPage.evaluate(() => { const hero = window.OneRingStore.getState().heroes[0]; window.OneRingStore.addLibrary({ name: 'Migration Trigger', kind: 'Bestia', endurance: 1, hate: 1 }); });
  await legacyPage.reload({ waitUntil: 'networkidle' });
  assert.equal(await legacyPage.evaluate(() => JSON.parse(localStorage.getItem('one-ring-state')).library.some(x => x.name === 'Legacy Warg')), true);
  await legacy.close();

  // Service worker must cache the app before offline reload.
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(async () => { if (navigator.serviceWorker.controller) return; await navigator.serviceWorker.ready; });
  await page.context().setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('[data-tab="map"]').count(), 1);
  await page.locator('[data-tab="map"]').click();
  assert.equal(await page.locator('#map-stage').isVisible(), true);
  await page.context().setOffline(false);

  // Narrow viewport layout and real touch pointer dispatch via CDP.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(baseURL, { waitUntil: 'networkidle' });
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  await mobilePage.evaluate(() => { window.OneRingStore.saveHero({ name: 'Touch Hero', endurance: 10, maxEndurance: 10, hope: 8, maxHope: 8 }); window.OneRingStore.addEnemy({ name: 'Touch Enemy', kind: 'Bestia', endurance: 10, maxEndurance: 10, hate: 4, maxHate: 4 }); window.OneRingStore.setMap(window.OneRingMap.generateTerrain('clearing', 'medium', 'touch')); });
  await mobilePage.locator('[data-tab="map"]').click();
  const touchToken = mobilePage.locator('.map-token').first();
  await touchToken.waitFor();
  const touchId = await touchToken.getAttribute('data-id');
  const touchBefore = await mobilePage.evaluate(id => JSON.parse(localStorage.getItem('one-ring-state')).map.positions[id], touchId);
  const touchBox = await touchToken.boundingBox();
  const cdp = await mobile.newCDPSession(mobilePage);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchBox.x + touchBox.width / 2, y: touchBox.y + touchBox.height / 2, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchBox.x + touchBox.width / 2 + 35, y: touchBox.y + touchBox.height / 2 + 25, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notDeepEqual(await mobilePage.evaluate(id => JSON.parse(localStorage.getItem('one-ring-state')).map.positions[id], touchId), touchBefore);
  await mobile.close();

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(observerErrors, []);
  await page.locator('[data-tab="heroes"]').click();
  await page.screenshot({ path: path.join(screenshotDir, 'one-ring-heroes.png'), fullPage: true });
  await browser.close();
  console.log('Browser smoke passed: hero, map encounter, clear, backup, migration, offline, mobile, no page errors.');
}

main().catch(async error => { console.error(error); if (browser) await browser.close().catch(() => {}); process.exitCode = 1; });
