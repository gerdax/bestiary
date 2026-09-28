/* Rebuild our vector-authored atlas: NODE_PATH=<Playwright modules> node scripts/dice-textures.cjs.
   Coordinates follow the CC0 Dice Box default mesh UV layout; no upstream pixels are edited. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page = await browser.newPage();
  const faces = [[1,160,310],[2,160,600],[3,154,738],[4,60,660],[5,160,165],[6,153,450],[7,60,510],[8,160,880],[9,69,809],[10,60,225],[1,940,400],[2,480,100],[3,300,100],[4,940,585],[5,940,755],[6,940,940]];
  for (const [actor,color] of [['hero','#302b22'],['enemy','#fff1cd']]) {
    const folder=path.join(__dirname,'../vendor/dice-box/assets/themes/tor-'+actor);
    fs.mkdirSync(folder,{recursive:true});
    const marks=faces.map(([v,x,y])=>`<text x="${x}" y="${y}" font-family="Georgia,serif" font-weight="bold" font-size="${x>400?85:58}" text-anchor="middle" dominant-baseline="central">${v}</text>${v===6?`<path d="M ${x-7} ${y+35} h 14 M ${x} ${y+28} v 14 M ${x-5} ${y+30} l 10 10 M ${x-5} ${y+40} l 10 -10" stroke-width="3"/>`:''}`).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><g fill="${color}" stroke="${color}">${marks}<g transform="translate(60 375)" fill="none" stroke-width="5"><path d="M -34 0 Q 0 -32 34 0 Q 0 32 -34 0Z"/><path d="M 0 -18 Q 12 0 0 18 Q -12 0 0 -18Z"/></g><g transform="translate(60 955)" fill="none" stroke-width="6" stroke-linecap="round"><path d="M 0 28 V -28 M -22 -8 L 0 -28 L 22 -8 M 0 5 L 21 -15"/></g></g></svg>`;
    fs.writeFileSync(path.join(folder,'symbols.svg'),svg);
    const png=await page.evaluate(async svg=>{const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(svg);await img.decode();const c=document.createElement('canvas');c.width=c.height=1024;c.getContext('2d').drawImage(img,0,0);return c.toDataURL('image/png').split(',')[1];},svg);
    fs.writeFileSync(path.join(folder,'symbols.png'),Buffer.from(png,'base64'));
    fs.writeFileSync(path.join(folder,'theme.config.json'),JSON.stringify({name:actor==='hero'?'Kości Bohatera':'Kości Wroga',systemName:'tor-'+actor,author:'Bestiariusz Śródziemia',version:1,meshFile:'../default/default.json',material:{type:'color',diffuseTexture:{light:'symbols.png',dark:'symbols.png'},diffuseLevel:1,specularPower:12},diceAvailable:['d6','d12']},null,2)+'\n');
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
