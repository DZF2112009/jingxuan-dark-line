const puppeteer = require('puppeteer-core');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..', '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--allow-file-access-from-files'],
    defaultViewport: { width: 1600, height: 900 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, e.stack));
  page.on('console', (m) => console.log('CONSOLE', m.type(), m.text()));
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'load' });
  await wait(3000);
  await page.$eval('[data-act="start-game"]', (el) => el.click());
  await wait(800);
  const info = await page.evaluate(() => {
    const box = document.querySelector('.chat-body');
    return {
      chatLen: window.__AX.S.chat.length,
      chat: window.__AX.S.chat,
      boxHTML: box ? box.innerHTML.slice(0, 400) : null,
      boxRect: box ? box.getBoundingClientRect().toJSON() : null,
      childCount: box ? box.childElementCount : null,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
