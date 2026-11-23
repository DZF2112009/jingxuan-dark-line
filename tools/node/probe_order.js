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
    args: ['--allow-file-access-from-files', '--window-size=1600,900'],
    defaultViewport: { width: 1600, height: 900 },
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await wait(3200);
  await page.$eval('[data-act="start-game"]', (el) => el.click());
  await wait(700);
  await page.$eval('.dicon[data-app="mall"]', (el) => el.click());
  await wait(600);
  await page.screenshot({ path: path.join(ROOT, 'shots', '40_mall_home.png') });

  // 打开四件，加车（顺序：八音盒 → 台灯 → 磨 → 留声机）
  for (const id of ['p2', 'p3', 'p4', 'p1']) {
    await page.evaluate((x) => { window.__AX.mallGo('item:' + x); }, id);
    await wait(450);
    await page.$eval('[data-act="cart-add"]', (el) => el.click());
    await wait(350);
  }
  await page.screenshot({ path: path.join(ROOT, 'shots', '41_product_cart.png') });
  await page.$eval('[data-act="go"][data-route="cart"]', (el) => el.click());
  await wait(500);
  await page.screenshot({ path: path.join(ROOT, 'shots', '42_cart.png') });

  // 错误批次
  await page.$eval('[data-batch]', (el) => { el.value = '1948'; });
  await page.$eval('[data-act="checkout"]', (el) => el.click());
  await wait(500);
  const badBatch = await page.$eval('[data-cart-msg]', (el) => el.textContent.trim());
  await page.screenshot({ path: path.join(ROOT, 'shots', '43_cart_err.png') });

  // 错误次序：把第 1 件移掉再补到最后
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-act="cart-rm"]')];
    rows[0].click();
  });
  await wait(400);
  const afterRm = await page.evaluate(() => window.__AX.M.cart);
  await page.evaluate(() => { window.__AX.mallGo('item:p2'); });
  await wait(400);
  await page.$eval('[data-act="cart-add"]', (el) => el.click());
  await wait(300);
  await page.evaluate(() => { window.__AX.mallGo('cart'); });
  await wait(400);
  await page.$eval('[data-batch]', (el) => { el.value = '1947'; });
  await page.$eval('[data-act="checkout"]', (el) => el.click());
  await wait(500);
  const badOrder = await page.$eval('[data-cart-msg]', (el) => el.textContent.trim());

  // 清空重来，按正确次序
  await page.evaluate(() => { window.__AX.M.cart = []; });
  await wait(100);
  for (const id of ['p2', 'p3', 'p4', 'p1']) {
    await page.evaluate((x) => { window.__AX.mallGo('item:' + x); }, id);
    await wait(420);
    await page.$eval('[data-act="cart-add"]', (el) => el.click());
    await wait(300);
  }
  await page.evaluate(() => { window.__AX.mallGo('cart'); });
  await wait(450);
  await page.$eval('[data-batch]', (el) => { el.value = '1947'; });
  await page.screenshot({ path: path.join(ROOT, 'shots', '44_cart_ready.png') });
  await page.$eval('[data-act="checkout"]', (el) => el.click());
  await wait(2000);
  const gate = await page.evaluate(() => ({ route: window.__AX.M.route, url: document.querySelector('[data-url]').value, cartReady: window.__AX.S.flags.cartReady }));
  await page.screenshot({ path: path.join(ROOT, 'shots', '45_gate.png') });

  // 邀请码
  await page.$eval('[data-dark-code]', (el) => { el.value = 'K7'; });
  await page.$eval('[data-act="dark-enter"]', (el) => el.click());
  await wait(1800);
  const final1 = await page.evaluate(() => ({ route: window.__AX.M.route, url: document.querySelector('[data-url]').value, ledger: window.__AX.S.flags.ledgerSeen }));
  await page.screenshot({ path: path.join(ROOT, 'shots', '46_ledger.png') });

  console.log(JSON.stringify({ badBatch, afterRm, badOrder, gate, final1, errs }, null, 2));
  await browser.close();
}
main().catch((e) => { console.error('FAILED', e); process.exit(1); });
