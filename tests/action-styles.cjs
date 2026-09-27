const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const page=await browser.newPage();
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8765');
    const ids=await page.evaluate(()=>{
      const h=OneRingStore.saveHero({name:'Bohater testowy'});
      OneRingStore.addHero(h.id);
      const template=OneRingStore.addLibrary({name:'Ork testowy',might:1});
      const e=OneRingStore.addEnemy(template);
      OneRingStore.setMap(OneRingMap.generateTerrain('clearing','medium','styles'));
      OneRingMap.selectParticipant(e.id);
      return {hero:h.id,enemy:e.id};
    });
    const check=async selector=>{
      const result=await page.locator(selector).first().evaluate(n=>{const s=getComputedStyle(n);return [s.color,s.backgroundColor,s.textDecorationLine,s.textDecorationThickness,s.textUnderlineOffset]});
      assert.deepEqual(result.slice(0,4),['rgb(196, 73, 62)','rgba(0, 0, 0, 0)','underline','1px'],selector);
    };
    for(const width of [1280,390]) {
      await page.setViewportSize({width,height:900});
      await page.locator('[data-tab="heroes"]').click();
      for(const selector of ['[data-hero-action="new"]','[data-hero-action="delete"]','#export-backup','#restore-backup']) await check(selector);
      assert.equal(await page.locator('.hero-editor').evaluate(n=>getComputedStyle(n).getPropertyValue('--sheet-red').trim()),'#c4493e');
      await page.locator('[data-tab="opponents"]').click();
      await check('#create-enemy');
      const own=page.locator('[data-category="Własne"]');
      if(await own.getAttribute('aria-pressed')!=='true') await own.click();
      await check('.library-actions .delete');
      assert.equal(await page.locator('.library-actions .add').first().evaluate(n=>getComputedStyle(n).textDecorationLine),'none');
      await page.locator('#create-enemy').click();
      await check('#randomize');
      await page.locator('[data-tab="map"]').click();
      for(const selector of ['#map-add-heroes','#map-clear','.map-panel-remove']) await check(selector);
      for(const selector of ['.map-switch-type','#map-panel h3','#map-enemy-details summary','.map-panel-action','.tab.active']) assert.equal(await page.locator(selector).first().evaluate(n=>getComputedStyle(n).textDecorationLine),'none',selector);
      await page.locator('.map-panel-remove').focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('.map-panel-remove').evaluate(n=>getComputedStyle(n).outlineStyle),'solid');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.locator('#map-panel').screenshot({path:`/tmp/action-styles-${width}.png`});
    }
    await page.evaluate(id=>OneRingStore.removeParticipant('hero:'+id),ids.hero);
    assert.equal(await page.locator('.map-switch-type').isDisabled(),true);
    assert.equal(await page.locator('.map-switch-type').evaluate(n=>getComputedStyle(n).opacity),'1');
    assert.equal(await page.locator('.map-switch-type').evaluate(n=>getComputedStyle(n).textDecorationLine),'none');
    assert.equal(await page.locator('.map-switch-type').evaluate(n=>getComputedStyle(n).color),'rgb(196, 73, 62)');
    console.log('Action styles passed: shared red, underlines, exclusions, keyboard focus, disabled and responsive layout.');
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
