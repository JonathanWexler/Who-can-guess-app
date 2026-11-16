// Renders the square PNG icons from logo.webp (run before `node build.js`).
// Regular icons fill the square; the "maskable" one leaves room for Android's round crop.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const logo = 'data:image/webp;base64,' + require('fs').readFileSync(__dirname + '/logo.webp').toString('base64');
  const icons = [['favicon-32.png', 32, 0.98], ['apple-touch-icon.png', 180, 0.9], ['icon-192.png', 192, 0.9], ['icon-512.png', 512, 0.9], ['icon-maskable-512.png', 512, 0.7]];
  for (const [name, size, fill] of icons) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>html,body{margin:0;width:${size}px;height:${size}px;background:#000;display:grid;place-items:center;overflow:hidden}img{width:${fill * 100}%;height:auto}</style><img src="${logo}">`);
    await p.waitForFunction(() => document.querySelector('img').complete);
    await p.screenshot({ path: `${__dirname}/${name}` });
    await p.close();
  }
  await b.close();
  console.log('icons written');
})();
