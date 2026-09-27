const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const page = await browser.newPage();
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8765');
    await page.locator('[data-tab="map"]').click();
    const center = page.locator('#map-center');
    assert.equal(await center.isDisabled(),true);
    const ids = await page.evaluate(()=>{
      const hero = OneRingStore.saveHero({name:'Bohater'});
      const h = OneRingStore.addHero(hero.id).id;
      const e = OneRingStore.addEnemy({name:'Ork',might:1}).id;
      OneRingStore.setMap(OneRingMap.generateTerrain('clearing','medium','center'));
      return [h,e];
    });
    assert.equal(await center.isDisabled(),true);
    for (const width of [1280,390]) {
      await page.setViewportSize({width,height:900});
      for (const id of ids) {
        await page.evaluate(id=>OneRingMap.selectParticipant(id),id);
        await page.locator('#map-zoom-in').click();
        const before = await page.evaluate(()=>({state:JSON.stringify(OneRingStore.getState()),zoom:new DOMMatrix(getComputedStyle(document.querySelector('#map-stage')).transform).a}));
        await center.click();
        const result = await page.evaluate(id=>{
          const view=document.querySelector('#map-viewport'), v=view.getBoundingClientRect();
          const marker=Array.from(document.querySelectorAll('.map-token')).find(n=>n.dataset.id===id).querySelector('.map-token-symbol').getBoundingClientRect();
          return {dx:marker.left+marker.width/2-(v.left+view.clientLeft+view.clientWidth/2),dy:marker.top+marker.height/2-(v.top+view.clientTop+view.clientHeight/2),state:JSON.stringify(OneRingStore.getState()),zoom:new DOMMatrix(getComputedStyle(document.querySelector('#map-stage')).transform).a};
        },id);
        assert.ok(Math.abs(result.dx)<1 && Math.abs(result.dy)<1,JSON.stringify(result));
        assert.equal(result.zoom,before.zoom);
        assert.equal(result.state,before.state);
      }
    }
    const extraEnemy = await page.evaluate(()=>OneRingStore.addEnemy({name:'Drugi ork',might:1}).id);
    await page.evaluate(id=>OneRingMap.selectParticipant(id),extraEnemy);
    await page.getByRole('button',{name:'Przełącz na bohatera',exact:true}).click();
    assert.equal(await page.locator('.map-token.is-selected').getAttribute('data-id'),ids[0]);
    await page.getByRole('button',{name:'Przełącz na przeciwnika',exact:true}).press('Enter');
    assert.equal(await page.locator('.map-token.is-selected').getAttribute('data-id'),extraEnemy);
    await page.getByRole('button',{name:'Przełącz na bohatera',exact:true}).click();
    await page.evaluate(id=>OneRingStore.removeParticipant(id),extraEnemy);
    await page.getByRole('button',{name:'Przełącz na przeciwnika',exact:true}).click();
    assert.equal(await page.locator('.map-token.is-selected').getAttribute('data-id'),ids[1]);
    await page.evaluate(id=>OneRingStore.removeParticipant(id),ids[0]);
    assert.equal(await page.getByRole('button',{name:'Przełącz na bohatera',exact:true}).isDisabled(),true);
    await page.evaluate(()=>OneRingStore.clearEncounter());
    assert.equal(await center.isDisabled(),true);
    console.log('Map centering passed for heroes and enemies, desktop/mobile, zoom preservation and empty map.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
