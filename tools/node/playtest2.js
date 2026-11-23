const puppeteer = require('puppeteer-core');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..', '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
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
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'load' });
  await wait(3200);
  const shot = async (n) => { await wait(100); await page.screenshot({ path: path.join(ROOT, 'shots', n) }); };

  await page.$eval('[data-act="start-game"]', (el) => el.click());
  await wait(600);

  // 提示流程
  await page.$eval('[data-act="chip"][data-say="我卡住了"]', (el) => el.click());
  await wait(1200);
  const hintState = await page.evaluate(() => ({ hints: window.__AX.S.hints, last: window.__AX.S.chat.slice(-1)[0] }));

  // 打开商城，检查首页与样品页完整截图
  await page.$eval('.dicon[data-app="mall"]', (el) => el.click());
  await wait(500);
  await page.$eval('.sample-card', (el) => el.click());
  await wait(500);
  await page.evaluate(() => { document.querySelector('[data-page]').scrollTop = 620; });
  await wait(400);
  await shot('20_sample_scrolled.png');

  // 商品页 p1（价签）
  await page.$eval('[data-act="go"][data-route="home"]', (el) => el.click());
  await wait(300);
  await page.$eval('[data-route="item:p1"]', (el) => el.click());
  await wait(500);
  const priceState = await page.evaluate(() => ({ priceSeen: window.__AX.S.flags.priceSeen, clues: window.__AX.S.clues.length }));
  await shot('21_product.png');

  // 源码面板
  await page.$eval('[data-act="source"]', (el) => el.click());
  await wait(400);
  await shot('22_source.png');

  const addIds = async (ids, clear) => {
    if (clear) await page.evaluate(() => { window.__AX.M.cart = []; });
    for (const id of ids) {
      await page.evaluate((x) => { window.__AX.mallGo('item:' + x); }, id);
      await wait(400);
      await page.$eval('[data-act="cart-add"]', (el) => el.click());
      await wait(300);
    }
    await page.evaluate(() => { window.__AX.mallGo('cart'); });
    await wait(400);
  };
  const submit = async () => {
    await page.$eval('[data-act="checkout"]', (el) => el.click());
    await wait(500);
    return page.$eval('[data-cart-msg]', (el) => el.textContent.trim());
  };

  // 先过客服通道
  await page.$eval('[data-act="home"]', (el) => el.click());
  await wait(300);
  await page.$eval('[data-act="go"][data-route="service"]', (el) => el.click());
  await wait(300);
  await page.$eval('[data-svc-input]', (el) => { el.value = 'SHIPPING'; });
  await page.$eval('[data-act="svc-send"]', (el) => el.click());
  await wait(1000);

  // 客服通过后：自提单的四种失败
  await addIds([], true);
  await page.$eval('[data-batch]', (el) => { el.value = '1947'; });
  const emptyMsg = await submit();

  await addIds(['p2', 'p3'], true);
  await page.$eval('[data-batch]', (el) => { el.value = '1947'; });
  const shortMsg = await submit();

  await addIds(['p3', 'p2', 'p4', 'p1'], true);
  await page.$eval('[data-batch]', (el) => { el.value = '1947'; });
  const orderMsg = await submit();

  await addIds(['p2', 'p3', 'p4', 'p1'], true);
  await page.$eval('[data-batch]', (el) => { el.value = '1900'; });
  const batchMsg = await submit();
  await shot('23_cart_error.png');

  // 正确单子 → 暗门
  await page.$eval('[data-batch]', (el) => { el.value = '1947'; });
  await page.$eval('[data-act="checkout"]', (el) => el.click());
  await wait(1900);
  await shot('23_dark_gate.png');

  // 错邀请码
  await page.$eval('[data-dark-code]', (el) => { el.value = 'K9'; });
  await page.$eval('[data-act="dark-enter"]', (el) => el.click());
  await wait(600);
  const wrongMsg = await page.$eval('[data-dark-msg]', (el) => el.textContent.trim());
  await shot('23_dark_error.png');

  // 正确邀请码（摩斯原文，页内直接解码）
  await page.$eval('[data-dark-code]', (el) => { el.value = '—·—  ——···'; });
  await page.$eval('[data-act="dark-enter"]', (el) => el.click());
  await wait(2400);
  await shot('24_ledger.png');

  // 上报错误答案 → 再正确
  await page.$eval('[data-chat-input]', (el) => { el.value = 'K-07 里昂 05:10'; });
  await page.$eval('[data-act="send"]', (el) => el.click());
  await wait(1400);
  const wrongReply = await page.evaluate(() => window.__AX.S.chat.slice(-1)[0].html);
  await page.$eval('[data-chat-input]', (el) => { el.value = 'K-07 布宜诺斯艾利斯 07:40'; });
  await page.$eval('[data-act="send"]', (el) => el.click());
  await wait(5200);
  await page.$eval('[data-act="ending"][data-key="c"]', (el) => el.click());
  await wait(3000);
  await shot('25_ending_c.png');

  // 重置
  await page.$eval('[data-act="result-reset"]', (el) => el.click());
  await wait(1200);
  const afterReset = await page.evaluate(() => ({
    flags: window.__AX.S.flags, hints: window.__AX.S.hints, chat: window.__AX.S.chat.length,
    kestrelIconCount: document.querySelectorAll('.dicon[data-app="kestrel"]').length,
    mallOpen: !!document.querySelector('.win[data-app="mall"]'),
    cart: window.__AX.M.cart.length,
    windows: Object.keys(window.__AX.S.wins)
  }));
  await shot('26_reset.png');

  console.log(JSON.stringify({ hintState, priceState, emptyMsg, shortMsg, orderMsg, batchMsg, wrongMsg, wrongReply, afterReset, errs }, null, 2));
  await browser.close();
}

run().catch((e) => { console.error('FAILED', e); process.exit(1); });
