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

  const headerWidths = () =>
    page.$$eval('[role="columnheader"]', (hs) => hs.map((h) => Math.round(h.getBoundingClientRect().width)));
  const unfitted = await headerWidths();
  await page.click('[data-fit-all]');
  const fitted = await headerWidths();
  const fitAll = await page.$eval('.status', (s) => s.textContent);
  const t3 = await tracks();
  check(
    'fit all moves the columns, tracks still shared',
    /^auto-fit all: /.test(fitAll) && fitted.join() !== unfitted.join() && t3.same,
    { unfitted, fitted, fitAll },
  );
  const refit = {};
  for (const key of await page.$$eval('[data-table-resize]', (hs) => hs.map((h) => h.dataset.tableResize))) {
    const kh = await page.$(`[data-table-resize="${key}"]`);
    const b = await kh.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2, { clickCount: 2 });
    refit[key] = await headerWidths();
  }
  check(
    'a double-click on any border after fit all changes no width',
    Object.keys(refit).length > 1 && Object.values(refit).every((w) => w.join() === fitted.join()),
    { fitted, refit },
  );

  const headerBg = () => page.$eval('[data-table-header]', (h) => getComputedStyle(h).backgroundColor);
  const light = await headerBg();
  await page.click('.toolbar label:nth-of-type(1) input');
  const dark = await headerBg();
  check('the colour variables follow the theme', light !== dark, [light, dark]);

  // The marquee, on a fresh page so nothing above has scrolled or selected.
  const mq = await browser.newPage();
  mq.on('pageerror', (e) => errors.push(String(e)));
  await mq.goto(url, { waitUntil: 'networkidle0' });
  await mq.waitForSelector('[role="grid"] [role="row"][aria-rowindex="8"]');
  const rowBox = (rowIndex) =>
    mq.$eval(`[role="grid"] [role="row"][aria-rowindex="${rowIndex}"]`, (r) => {
      const b = r.getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    });
  const selectedRows = () =>
    mq.$$eval('[role="row"][aria-selected="true"]', (rs) => rs.map((r) => Number(r.getAttribute('aria-rowindex'))));
  const rectangle = () =>
    mq.$eval('[data-table-marquee]', (m) => {
      const s = getComputedStyle(m);
      return { display: s.display, fill: s.backgroundColor, height: m.getBoundingClientRect().height };
    });
  const scrollerTop = () =>
    mq.evaluate(() => {
      const s = [...document.querySelectorAll('[role="grid"] div')].find((d) => getComputedStyle(d).overflowY === 'auto');
      const r = s.getBoundingClientRect();
      return { scrollTop: s.scrollTop, bottom: r.bottom };
    });

  // Pressed on the last column, away from the name the example refuses a marquee on.
  const r3 = await rowBox(3);
  const r6 = await rowBox(6);
  const px = r3.x + r3.width - 40;
  await mq.mouse.move(px, r3.y + r3.height / 2);
  await mq.mouse.down();
  await mq.mouse.move(px - 30, r6.y + r6.height / 2, { steps: 6 });
  const during = await rectangle();
  await mq.mouse.up();
  const afterRelease = await rectangle();
  const dragged = await selectedRows();
  const focusOnGrid = await mq.evaluate(() => document.activeElement?.getAttribute('role') === 'grid');
  check('a marquee over four rows selects those four, and the release’s click does not undo it', dragged.join() === '3,4,5,6', dragged);
  check(
    'the rectangle shows in its colours while dragged, and goes at the release',
    during.display === 'block' && during.fill !== 'rgba(0, 0, 0, 0)' && during.height > 0 && afterRelease.display === 'none',
    { during, afterRelease },
  );
  check('the grid keeps keyboard focus after a marquee', focusOnGrid);

  // Held past the bottom edge: the example's loop scrolls, and the range follows the scroll.
  const s0 = await scrollerTop();
  await mq.mouse.move(px, r3.y + r3.height / 2);
  await mq.mouse.down();
  await mq.mouse.move(px, s0.bottom + 20, { steps: 6 });
  await new Promise((r) => setTimeout(r, 400));
  const held = await scrollerTop();
  await mq.keyboard.press('Escape');
  const cancelled = await selectedRows();
  await mq.mouse.up();
  check('a marquee held past the bottom edge scrolls the grid', held.scrollTop > 0, { scrollTop: held.scrollTop });
  check('Escape puts the selection back as it was before the drag', cancelled.join() === dragged.join(), cancelled);

  // Pressed and released on one row, so the browser's click lands on that row: with Ctrl held, a
  // click that got through would toggle the row straight back off. Scrolled back first: the drag above
  // left row 8 above the view.
  await mq.evaluate(() => {
    [...document.querySelectorAll('[role="grid"] div')].find((d) => getComputedStyle(d).overflowY === 'auto').scrollTop = 0;
  });
  await new Promise((r) => setTimeout(r, 100));
  const r8 = await rowBox(8);
  await mq.keyboard.down('Control');
  await mq.mouse.move(px, r8.y + r8.height / 2);
  await mq.mouse.down();
  await mq.mouse.move(px - 60, r8.y + r8.height / 2, { steps: 6 });
  await mq.mouse.up();
  await mq.keyboard.up('Control');
  const toggled = await selectedRows();
  check('a Ctrl marquee inside one row adds it, and the click on that row does not toggle it back', toggled.join() === '3,4,5,6,8', toggled);

  // A file's name refuses a marquee, and only its text: the rest of the name column starts one.
  const nameGeo = await mq.$eval('[role="grid"] [role="row"][aria-rowindex="10"] [data-name]', (span) => {
    const text = document.createRange();
    text.selectNodeContents(span);
    const t = text.getBoundingClientRect();
    const cell = span.parentElement.getBoundingClientRect();
    return { textLeft: t.left, textRight: t.right, cellRight: cell.right, y: (t.top + t.bottom) / 2 };
  });
  const r12 = await rowBox(12);
  const dragFrom = async (x) => {
    await mq.mouse.move(x, nameGeo.y);
    await mq.mouse.down();
    await mq.mouse.move(x, r12.y + r12.height / 2, { steps: 6 });
    const shown = (await rectangle()).display;
    await mq.mouse.up();
    return shown;
  };
  const onText = await dragFrom((nameGeo.textLeft + nameGeo.textRight) / 2);
  const pastText = await dragFrom((nameGeo.textRight + nameGeo.cellRight) / 2);
  const fromName = await selectedRows();
  check(
    'a press on a name’s text starts no marquee, and one beside it in the name column does',
    onText === 'none' && pastText === 'block' && fromName.join() === '10,11,12',
    { onText, pastText, selected: fromName, text: [nameGeo.textLeft, nameGeo.textRight], cellRight: nameGeo.cellRight },
  );

  // Disabled by its class alone, which jsdom cannot see.
  await mq.click('.toolbar label:nth-of-type(2) input');
  await mq.mouse.move(px, r3.y + r3.height / 2);
  await mq.mouse.down();
  await mq.mouse.move(px, r6.y + r6.height / 2, { steps: 6 });
  const whileDisabled = await rectangle();
  await mq.mouse.up();
  const untouched = await selectedRows();
  check(
    'a disabled grid draws no marquee and selects nothing',
    whileDisabled.display === 'none' && untouched.join() === fromName.join(),
    { rectangle: whileDisabled.display, selected: untouched },
  );
  await mq.close();

  // A narrower page, so the table overflows before the name column reaches its maximum.
  const narrow = await browser.newPage();
  narrow.on('pageerror', (e) => errors.push(String(e)));
  await narrow.setViewport({ width: 700, height: 800 });
  await narrow.goto(url, { waitUntil: 'networkidle0' });
  await narrow.waitForSelector('[data-table-resize="name"]');
  const nameWidth = () =>
    narrow.$eval('[role="columnheader"][aria-colindex="1"]', (h) => h.getBoundingClientRect().width);
  const scrollerOf = () =>
    narrow.evaluate(() => {
      const s = [...document.querySelectorAll('[role="grid"] div')].find(
        (d) => getComputedStyle(d).overflowX === 'auto',
      );
      const r = s.getBoundingClientRect();
      return { left: s.scrollLeft, right: r.right };
    });
  const w0 = await nameWidth();
  const { right } = await scrollerOf();
  const nb = await (await narrow.$('[data-table-resize="name"]')).boundingBox();
  const from = nb.x + nb.width / 2;
  const to = right + 10;
  await narrow.mouse.move(from, nb.y + nb.height / 2);
  await narrow.mouse.down();
  await narrow.mouse.move(to, nb.y + nb.height / 2, { steps: 10 });
  await new Promise((r) => setTimeout(r, 150));
  // Released first, so the loop has stopped and the width and the scroll are read at one moment.
  await narrow.mouse.up();
  await new Promise((r) => setTimeout(r, 100));
  const w1 = await nameWidth();
  const s1 = await scrollerOf();
  const pointerOnly = w0 + (to - from);
  // The name column's maximum in FileTable's spec.
  const expected = Math.min(720, pointerOnly + s1.left);
  // The window: the scroller must have scrolled, or the width check below says nothing.
  check('a border held past the right edge scrolls the grid', s1.left > 0, { scrollLeft: s1.left });
  check(
    'and the column widens by the distance scrolled too',
    w1 > pointerOnly + 1 && Math.abs(w1 - expected) <= 2,
    { w0, w1, pointerOnly, expected, scrollLeft: s1.left },
  );

  // Scrolled to the end, a border dragged left: the browser pulls the scroll back as the content
  // narrows, and that must not shrink the column further.
  await narrow.evaluate(() => {
    const s = [...document.querySelectorAll('[role="grid"] div')].find(
      (d) => getComputedStyle(d).overflowX === 'auto',
    );
    s.scrollLeft = s.scrollWidth;
  });
  await new Promise((r) => setTimeout(r, 100));
  const pinned = await scrollerOf();
  const wp = await nameWidth();
  const pb = await (await narrow.$('[data-table-resize="name"]')).boundingBox();
  await narrow.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await narrow.mouse.down();
  await narrow.mouse.move(pb.x + pb.width / 2 - 20, pb.y + pb.height / 2, { steps: 4 });
  await new Promise((r) => setTimeout(r, 200));
  await narrow.mouse.up();
  const wq = await nameWidth();
  const after2 = await scrollerOf();
  check('scrolled to the end, the scroll was pinned there', pinned.left > 0, { scrollLeft: pinned.left });
  check(
    'and a border dragged 20 px left shrinks its column by 20',
    Math.abs(wp - 20 - wq) <= 1 && after2.left > 0,
    { before: wp, after: wq, scrollLeft: after2.left },
  );
  await narrow.close();

  check('no page errors', errors.length === 0, errors);
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed in ${executablePath}`);
process.exit(failed === 0 && results.length > 0 ? 0 : 1);
