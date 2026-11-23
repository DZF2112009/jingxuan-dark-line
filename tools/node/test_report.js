const puppeteer = require('puppeteer-core');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..', '..');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 3000));
  const cases = [
    'K-07 布宜诺斯艾利斯 07:40',
    'K07 布宜诺斯艾利斯 7:40',
    'K-07 布宜诺斯艾利斯 07：40',
    'K—07 布宜诺斯艾利斯 7点40',
    'K_07 布宜诺斯艾利斯 0740',
    'K-07 / 布宜诺斯艾利斯 / 7 40',
    'K-07 布宜诺斯艾利斯',
    'K-07 07:40',
    '布宜诺斯艾利斯 07:40',
    'kestrel.1947',
    'K-05 里昂 05:10'
  ];
  const out = await page.evaluate((list) => list.map((t) => ({ t, r: window.__AX.parseReport(t) })), cases);
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
