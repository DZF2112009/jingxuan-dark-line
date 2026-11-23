const puppeteer = require('puppeteer-core');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..', '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files', '--window-size=1600,900'],
    defaultViewport: { width: 1600, height: 900 },
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'load' });
  await wait(3200);
  await page.$eval('[data-act="start-game"]', (el) => el.click());
  await wait(600);
  await page.$eval('.win[data-app="chat"] [data-act="close"]', (el) => el.click());
  await wait(400);
  await page.screenshot({ path: path.join(ROOT, 'shots', '34_desktop_clean.png') });
  await page.$eval('[data-act="start"]', (el) => el.click());
  await wait(400);
  await page.screenshot({ path: path.join(ROOT, 'shots', '35_start_menu.png') });
  console.log(JSON.stringify({ errs }));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
