const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(ROOT, 'shots');
const URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--window-size=1600,900', '--font-render-hinting=none'],
    defaultViewport: { width: 1600, height: 900 },
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await wait(3200);
  const shot = async (n) => { await wait(120); await page.screenshot({ path: path.join(SHOTS, n) }); };

  await page.$eval('[data-act="start-game"]', (el) => el.click());
  await wait(1200);
  await shot('02_desktop.png');

  // 1. 回话，触发任务
  await page.$eval('[data-chat-input]', (el) => { el.value = '在'; });
  await page.$eval('[data-act="send"]', (el) => el.click());
  await wait(7500);
  await shot('03_mission.png');

  // 2. 打开商城 → 样品页
  await page.$eval('.dicon[data-app="mall"]', (el) => el.click());
  await wait(700);
  await shot('04_mall_home.png');
  await page.$eval('.sample-card', (el) => el.click());
  await wait(600);
  await shot('05_sample.png');

  // 3. 图七
  await page.$eval('.th[data-i="7"]', (el) => el.click());
  await wait(600);
  await shot('06_plate.png');

  // 4. 展开折叠提问
  await page.$eval('[data-act="fold"]', (el) => el.click());
  await wait(500);
  await shot('07_folded.png');

  // 5. 解码器
  await page.$eval('.dicon[data-app="tool"]', (el) => el.click());
  await wait(400);
  await page.$eval('[data-in="b64"]', (el) => { el.value = 'U0hJUFBJTkc='; });
  await page.$eval('[data-act="run"][data-mode="b64d"]', (el) => el.click());
  await wait(300);
  const b64out = await page.$eval('[data-out="b64"]', (el) => el.textContent.trim());
  await shot('08_tool.png');

  await page.$eval('[data-act="tab"][data-tab="rev"]', (el) => el.click());
  await wait(200);
  await page.$eval('[data-in="rev"]', (el) => { el.value = window.__AX.COPY.note; });
  await page.$eval('[data-act="run"][data-mode="rev"]', (el) => el.click());
  await wait(300);
  const revout = await page.$eval('[data-out="rev"]', (el) => el.textContent.trim());
  await shot('09_reverse.png');

  // 6. 客服通道
  await page.evaluate(() => { window.__AX.M.route = 'home'; });
  await page.$eval('[data-act="go"][data-route="service"]', (el) => el.click());
  await wait(400);
  await page.$eval('[data-svc-input]', (el) => { el.value = 'SHIPPING'; });
  await page.$eval('[data-act="svc-send"]', (el) => el.click());
  await wait(900);
  await shot('10_service.png');
  const svcText = await page.$eval('[data-svc-body]', (el) => el.textContent.replace(/\s+/g, ' ').slice(-220));

  // 7. 按评语次序装购物车 → 提交自提单 → 跳进暗门
  await wait(1200);
  await page.evaluate(() => window.__AX.openApp('mall'));
  await wait(250);
  await page.evaluate(() => window.__AX.mallGo('home'));
  await wait(400);
  for (const id of ['p2', 'p3', 'p4', 'p1']) {
    await page.$eval('[data-route="item:' + id + '"]', (el) => el.click());
    await wait(500);
    await page.$eval('[data-act="cart-add"]', (el) => el.click());
    await wait(400);
    await page.$eval('[data-act="go"][data-route="home"]', (el) => el.click());
    await wait(350);
  }
  await page.$eval('[data-act="go"][data-route="cart"]', (el) => el.click());
  await wait(450);
  const cartIds = await page.evaluate(() => window.__AX.M.cart.slice());
  await page.$eval('[data-batch]', (el) => { el.value = '1947'; });
  await shot('11_cart.png');
  await page.$eval('[data-act="checkout"]', (el) => el.click());
  await wait(1900);
  await shot('11_dark_gate.png');
  const gateText = await page.$eval('.page.dark', (el) => el.textContent.replace(/\s+/g, ' ').slice(0, 160));
  await page.$eval('[data-dark-code]', (el) => { el.value = 'K7'; });
  await page.$eval('[data-act="dark-enter"]', (el) => el.click());
  await wait(1800);
  await shot('11_ledger.png');
  const darkUrl = await page.$eval('[data-url]', (el) => el.value);

  // 8. 上报
  await page.$eval('[data-chat-input]', (el) => { el.value = 'K-07 布宜诺斯艾利斯 07:40'; });
  await page.$eval('[data-act="send"]', (el) => el.click());
  await wait(6000);
  await shot('12_ending_choice.png');
  const hasChoice = await page.$('[data-act="ending"]');
  if (hasChoice) await page.$eval('[data-act="ending"][data-key="a"]', (el) => el.click());
  await wait(5000);
  await shot('13_result.png');

  const st = await page.evaluate(() => ({
    flags: window.__AX.S.flags,
    clues: window.__AX.S.clues.length,
    hints: window.__AX.S.hints,
    grade: document.querySelector('.grade') ? document.querySelector('.grade').textContent : null
  }));
  console.log(JSON.stringify({ b64out, revout, svcText, cartIds, gateText, darkUrl, st, errs }, null, 2));
  await browser.close();
}

main().catch((e) => { console.error('FAILED', e); process.exit(1); });
