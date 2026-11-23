const puppeteer = require('puppeteer-core');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..', '..');
const URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'load' });
  await wait(3200);
  await page.$eval('[data-act="start-game"]', (el) => el.click());
  await wait(600);
  await page.$eval('.dicon[data-app="mall"]', (el) => el.click());
  await wait(500);
  for (const id of ['p2', 'p3', 'p4', 'p1']) {
    await page.evaluate((x) => { window.__AX.mallGo('item:' + x); }, id);
    await wait(350);
    await page.$eval('[data-act="cart-add"]', (el) => el.click());
    await wait(250);
  }
  await page.evaluate(() => { window.__AX.mallGo('cart'); });
  await wait(400);
  await page.screenshot({ path: path.join(ROOT, 'shots', '37_mobile_cart.png') });
  await page.$eval('[data-batch]', (el) => { el.value = '1947'; });
  await page.$eval('[data-act="checkout"]', (el) => el.click());
  await wait(1800);
  await page.screenshot({ path: path.join(ROOT, 'shots', '37_mobile_dark.png') });
  const info = await page.evaluate(() => ({
    vw: document.documentElement.clientWidth,
    scrollW: document.documentElement.scrollWidth,
    codeBox: (() => { const el = document.querySelector('[data-dark-code]'); const b = el.getBoundingClientRect(); return { x: Math.round(b.x), w: Math.round(b.width) }; })(),
    overflowY: document.querySelector('.page.dark').scrollHeight > document.querySelector('.page.dark').clientHeight,
  }));
  await page.$eval('[data-dark-code]', (el) => { el.value = 'K7'; });
  await page.$eval('[data-act="dark-enter"]', (el) => el.click());
  await wait(1600);
  await page.screenshot({ path: path.join(ROOT, 'shots', '38_mobile_ledger.png') });
  console.log(JSON.stringify({ info, errs }, null, 2));
  await browser.close();
}
main().catch((e) => { console.error('FAILED', e); process.exit(1); });
