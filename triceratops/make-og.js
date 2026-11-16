// Renders og.png (the 1200x630 link-preview image) from the built page.
// Usage: node build.js && node make-og.js http://localhost:8101/index.html
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto(process.argv[2] || 'http://localhost:8101/index.html');
  await p.waitForTimeout(4500); // let the fade-ins finish
  await p.addStyleTag({ content: '.logo{width:auto !important;height:400px !important} .logo-wrap,.logo{animation:none !important;filter:none !important} .tag,.soon{opacity:1 !important;animation:none !important}' });
  await p.waitForTimeout(300);
  await p.screenshot({ path: __dirname + '/og.png' });
  await b.close();
})();
