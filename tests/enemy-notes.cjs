const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BASE_URL||'http://localhost:8765');
 await page.locator('[data-tab="opponents"]').click();await page.locator('#create-enemy').click();
 const notes='Pilnuje bramy.\n\n<img src=x onerror=alert(1)> — zwykły tekst';
 await page.locator('#name').fill('Strażnik notatek');await page.locator('#enemy-notes').fill(notes);
 await page.locator('#enemy-form [data-action="library"]').click();
 assert.equal(await page.evaluate(()=>OneRingStore.getState().library[0].notes),notes);
 await page.locator('.library-card').first().click();assert.equal(await page.locator('#enemy-notes').inputValue(),notes);
 await page.locator('#reset-form').click();await page.locator('.library-card .add').first().click();
 await page.locator('#map-generate').click();await page.locator('#map-enemy-notes > summary').click();
 assert.equal(await page.locator('#map-enemy-notes > p').textContent(),notes);
 assert.equal(await page.locator('#map-enemy-notes input, #map-enemy-notes textarea, #map-enemy-notes [contenteditable], #map-enemy-notes img').count(),0);
 const id=await page.evaluate(()=>OneRingStore.getState().battle[0].id);
 await page.reload();await page.locator('[data-tab="map"]').click();await page.evaluate(id=>OneRingMap.selectParticipant(id),id);
 assert.equal(await page.locator('#map-enemy-notes > p').textContent(),notes);
 await page.evaluate(()=>{const h=OneRingStore.saveHero({name:'Bohater'});const p=OneRingStore.addHero(h.id);OneRingMap.selectParticipant(p.id)});
 assert.equal(await page.locator('#map-enemy-notes').isHidden(),true);
 for(const notes of ['', '  \n  ']) {
  await page.evaluate(notes=>{const p=OneRingStore.addEnemy({name:'Bez notatek',notes});OneRingMap.selectParticipant(p.id)},notes);
  assert.equal(await page.locator('#map-enemy-notes').isHidden(),true);
  assert.equal(await page.locator('#map-enemy-details').isVisible(),true);
 }
 assert.deepEqual(errors,[]);console.log('Enemy notes passed: form, saved template, read-only map, literal text, reload and hero switching.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
