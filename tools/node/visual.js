const puppeteer = require('puppeteer-core');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..', '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--window-size=1600,900'],
    defaultViewport: { width: 1600, height: 900 },
  });
  const errs = [];
  const page = await browser.newPage();
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const shot = async (n) => { await wait(120); await page.screenshot({ path: path.join(ROOT, 'shots', n) }); };
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'load' });
  await wait(3200);
  await page.$eval('[data-act="start-game"]', (el) => el.click());
  await wait(500);
  await page.$eval('.dicon[data-app="mall"]', (el) => el.click());
  await wait(400);
  await page.$eval('.sample-card', (el) => el.click());
  await wait(500);
  await shot('27_sample_top.png');
  await page.evaluate(() => { document.querySelector('[data-page]').scrollTop = 300; });
  await shot('28_sample_thumbs.png');
  await page.evaluate(() => { document.querySelector('[data-page]').scrollTop = 760; });
  await shot('29_sample_qa.png');
  await page.$eval('[data-act="source"]', (el) => el.click());
  await wait(300);
  await shot('30_source.png');
  await page.$eval('[data-act="source"]', (el) => el.click());
  await page.$eval('[data-act="home"]', (el) => el.click());
  await wait(300);
  await page.$eval('[data-act="go"][data-route="service"]', (el) => el.click());
  await wait(300);
  await page.$eval('[data-svc-input]', (el) => { el.value = 'SHIPPING'; });
  await page.$eval('[data-act="svc-send"]', (el) => el.click());
  await wait(1100);
  await page.evaluate(() => window.__AX.openApp('mall'));
  await wait(250);
  for (const id of ['p2', 'p3', 'p4', 'p1']) {
    await page.evaluate((x) => { window.__AX.mallGo('item:' + x); }, id);
    await wait(400);
    await page.$eval('[data-act="cart-add"]', (el) => el.click());
    await wait(300);
  }
  await page.evaluate(() => { window.__AX.mallGo('cart'); });
  await wait(450);
  await page.$eval('[data-batch]', (el) => { el.value = '1947'; });
  await shot('39_cart.png');
  await page.$eval('[data-act="checkout"]', (el) => el.click());
  await wait(1900);
  await shot('31_dark_gate.png');

  // 移动端
  const m = await browser.newPage();
  await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await m.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'load' });
  await wait(3200);
  await m.$eval('[data-act="start-game"]', (el) => el.click());
  await wait(600);
  await m.screenshot({ path: path.join(ROOT, 'shots', '32_mobile_desktop.png') });
  await m.$eval('.dicon[data-app="mall"]', (el) => el.click());
  await wait(500);
  await m.screenshot({ path: path.join(ROOT, 'shots', '33_mobile_mall.png') });

  console.log(JSON.stringify({ errs, desktopSize: await page.evaluate(() => [document.body.clientWidth, document.body.clientHeight]) }, null, 2));
  await browser.close();
}
main().catch((e) => { console.error('FAILED', e); process.exit(1); });
