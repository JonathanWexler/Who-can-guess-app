// Renders the PNG icons from icon.svg (run after `node build.js`).
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const svg = fs.readFileSync(__dirname + '/icon.svg', 'utf8');
  for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>html,body{margin:0;background:#050507}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await p.screenshot({ path: `${__dirname}/${name}` });
    await p.close();
  }
  await b.close();
  console.log('icons written');
})();
