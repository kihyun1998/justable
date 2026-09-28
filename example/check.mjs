/**
 * The example in a real browser: serves it with Vite, drives it with an installed Chrome or Edge,
 * and fails on any check that does not hold — or when no browser is found, since a run that
 * inspected nothing is not a pass. What each check stands for: docs/map/territory/verification-gates.md.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const executablePath = BROWSERS.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error('no browser found — set CHROME_PATH. Nothing was checked.');
  process.exit(1);
}

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail === undefined ? '' : `  ${JSON.stringify(detail)}`}`);
};

const server = await createServer({
  configFile: fileURLToPath(new URL('./vite.config.ts', import.meta.url)),
  server: { port: 0 },
  logLevel: 'error',
});
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  defaultViewport: { width: 1280, height: 800 },
});

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[role="grid"] [data-table-header]');

  const tracks = () =>
    page.evaluate(() => {
      const grid = document.querySelector('[role="grid"]');
      const header = grid.querySelector('[data-table-header]');
      const row = grid.querySelector('[role="rowgroup"] [role="row"][aria-rowindex="2"]');
      const t = (el) => getComputedStyle(el).gridTemplateColumns;
      const w = (el) => Math.round(el.getBoundingClientRect().width);
      return { header: t(header), row: t(row), same: t(header) === t(row) && w(header) === w(row) };
    });

  const t0 = await tracks();
  check('header and row lay out the same tracks', t0.same, t0);

  const button = await page.$eval('[role="columnheader"] button', (b) => {
    const s = getComputedStyle(b);
    return {
      bg: s.backgroundColor,
      border: s.borderTopWidth,
      fontSize: s.fontSize,
      bodyFontSize: getComputedStyle(document.body).fontSize,
    };
  });
  check(
    'the sort button shows no browser button styles',
    button.bg === 'rgba(0, 0, 0, 0)' && button.border === '0px' && button.fontSize === button.bodyFontSize,
    button,
  );

  const drawn = await page.$$eval('[role="grid"] [role="row"][aria-rowindex]', (rs) => rs.length);
  check('only the rows in view are drawn', drawn > 10 && drawn < 100, { drawn, of: 5000 });

  const sortOf = () =>
    page.$eval('[role="columnheader"][aria-colindex="3"]', (h) => h.getAttribute('aria-sort'));
  const sizeButton = await page.$('[role="columnheader"][aria-colindex="3"] button');
  const cycle = [];
  for (let i = 0; i < 3; i += 1) {
    await sizeButton.click();
    cycle.push(await sortOf());
  }
  check('three presses walk first direction, other, none', cycle.join() === 'descending,ascending,', cycle);

  const handle = await page.$('[data-table-resize="name"]');
  const hb = await handle.boundingBox();
  const before = await page.$eval('[role="columnheader"][aria-colindex="1"]', (h) => h.getBoundingClientRect().width);
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 100, hb.y + hb.height / 2, { steps: 5 });
  await page.mouse.up();
  const after = await page.$eval('[role="columnheader"][aria-colindex="1"]', (h) => h.getBoundingClientRect().width);
  const t1 = await tracks();
  check('a border drag widens its column, tracks still shared', Math.round(after - before) === 100 && t1.same, {
    before,
    after,
  });

  const focusedText = () =>
    page.evaluate(() => {
      const id = document.querySelector('[role="grid"]').getAttribute('aria-activedescendant');
      return (id && document.getElementById(id)?.textContent) || null;
    });
  // The rows are in their given order now: "new" must land on news.txt, or the next check could
  // pass without the space doing anything.
  await page.focus('[role="grid"]');
  await page.keyboard.type('new', { delay: 40 });
  const onNew = await focusedText();
  check('typing "new" lands on "news.txt" first', onNew?.includes('news.txt') === true, onNew);
  await page.keyboard.type(' f', { delay: 40 });
  const focused = await focusedText();
  check('typing "new f" lands on "new folder"', focused?.includes('new folder') === true, focused);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  const selected = await page.$$eval('[role="row"][aria-selected="true"]', (rs) => rs.length);
  check('Space right after a move selects', selected === 1, { selected });

  const kind = await page.$('[data-table-resize="kind"]');
  const kb = await kind.boundingBox();
  await page.mouse.click(kb.x + kb.width / 2, kb.y + kb.height / 2, { clickCount: 2 });
  const fit = await page.$eval('.status', (s) => s.textContent);
  const t2 = await tracks();
  check('a double-click auto-fits, tracks still shared', /auto-fit kind: \d+px/.test(fit) && t2.same, fit);

  const headerBg = () => page.$eval('[data-table-header]', (h) => getComputedStyle(h).backgroundColor);
  const light = await headerBg();
  await page.click('.toolbar label:nth-of-type(1) input');
  const dark = await headerBg();
  check('the colour variables follow the theme', light !== dark, [light, dark]);

  check('no page errors', errors.length === 0, errors);
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed in ${executablePath}`);
process.exit(failed === 0 && results.length > 0 ? 0 : 1);
