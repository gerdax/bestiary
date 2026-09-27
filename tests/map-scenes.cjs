const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const page=await browser.newPage({viewport:{width:1400,height:1000}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8765');
    await page.locator('[data-tab="map"]').click();
    const scenes=['forest','clearing','ruins','cave','forest_clearing','forest_crossroads','road','river','river_ford','marsh','ravine'];
    assert.deepEqual((await page.locator('#map-scene option').evaluateAll(nodes=>nodes.map(n=>n.value))).sort(),[...scenes].sort());
    const id=await page.evaluate(()=>OneRingStore.addEnemy({name:'Strażnik',might:1}).id);
    page.on('dialog',dialog=>dialog.accept());
    for(const scene of scenes) {
      await page.locator('#map-scene').selectOption(scene);
      await page.locator('#map-generate').click();
      assert.equal(await page.locator('#map-error').isHidden(),true);
      assert.equal(await page.locator('#map-tokens .map-token').count(),1);
      // Fixed seed for visual comparisons, with the same persistence/render path.
      await page.evaluate(scene=>OneRingStore.setMap(OneRingMap.generateTerrain(scene,'medium','scene-preview-2026')),scene);
      await page.locator('#map-fit').click();
      assert.match(await page.locator('#map-terrain > rect').first().getAttribute('fill'), /^#[0-9a-f]{6}$/i, scene);
      if(scene==='river') {
        assert.equal(await page.locator('.map-feature-river').count(),1);
        assert.equal(await page.locator('.map-feature-ford, .map-feature-trail').count(),0);
      }
      await page.locator('#map-terrain').screenshot({path:`/tmp/scene-${scene}.png`});
      const saved=await page.evaluate(()=>OneRingStore.exportBackup());
      await page.reload();
      assert.deepEqual(await page.evaluate(()=>OneRingStore.exportBackup()),saved);
      await page.locator('[data-tab="map"]').click();
      await page.evaluate(()=>OneRingStore.restoreBackup(OneRingStore.exportBackup()));
      assert.equal(await page.locator('#map-scene').inputValue(),scene);
      assert.equal(await page.locator('#map-error').isHidden(),true);
      await page.setViewportSize({width:390,height:844});
      await page.locator('#map-fit').click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,scene);
      await page.locator('#map-viewport').screenshot({path:`/tmp/scene-mobile-${scene}.png`});
      await page.setViewportSize({width:1400,height:1000});
    }
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.evaluate(id=>OneRingMap.selectParticipant(id),id);
    assert.equal(await page.locator('#map-panel > h3').textContent(),'Strażnik');
    assert.deepEqual(errors,[]);
    console.log('All 11 scenes passed dropdown generation, rendering, reload, restore and mobile checks.');
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
