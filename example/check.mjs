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

/**
 * The drawn data rows on `page`, read once: the step between the first two, the first one's
 * `offsetHeight` and computed `height`, the first two's overlap on screen, and how many are drawn.
 */
const drawnRows = (page) =>
  page.evaluate(() => {
    const rows = [
      ...document.querySelectorAll('[role="grid"] [role="presentation"] > [role="row"][aria-rowindex]'),
    ].sort((a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')));
    return {
      step: Number.parseFloat(rows[1].style.top) - Number.parseFloat(rows[0].style.top),
      offsetHeight: rows[0].offsetHeight,
      computed: getComputedStyle(rows[0]).height,
      overlap: rows[0].getBoundingClientRect().bottom - rows[1].getBoundingClientRect().top,
      drawn: rows.length,
    };
  });

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail === undefined ? '' : `  ${JSON.stringify(detail)}`}`);
};

const server = await createServer({
  configFile: fileURLToPath(new URL('./vite.config.ts', import.meta.url)),
  server: { port: 0, watch: null, hmr: false },
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

  // A body cell against its row, and against the same cell centred by the row as before #16.
  const cells = await page.evaluate(() => {
    const row = document.querySelector('[role="grid"] [role="rowgroup"] [role="row"][aria-rowindex="3"]');
    const r = row.getBoundingClientRect();
    const textMiddle = (cell) => {
      const text = document.createRange();
      text.selectNodeContents(cell);
      const t = text.getBoundingClientRect();
      return (t.top + t.bottom) / 2;
    };
    return [...row.querySelectorAll('[role="gridcell"]')].map((cell) => {
      const b = cell.getBoundingClientRect();
      const x = b.left + Math.min(8, b.width / 2);
      const hits = (y) => document.elementFromPoint(x, y)?.closest('[role="gridcell"]') === cell;
      const middle = textMiddle(cell);
      cell.style.alignSelf = 'center';
      const before = textMiddle(cell);
      cell.style.alignSelf = '';
      const text = document.createRange();
      text.selectNodeContents(cell);
      return {
        key: cell.getAttribute('aria-colindex'),
        edges: hits(r.top + 1.5) && hits(r.bottom - 1.5),
        moved: +(middle - before).toFixed(2),
        rightGap: +(b.right - text.getBoundingClientRect().right).toFixed(2),
        padRight: parseFloat(getComputedStyle(cell).paddingRight),
        textAlign: getComputedStyle(cell).textAlign,
        display: getComputedStyle(cell).display,
      };
    });
  });
  check('a press just inside a body row’s top or bottom edge lands on a cell', cells.every((c) => c.edges), cells);
  check('a cell’s text sits where the row’s centring put it', cells.every((c) => Math.abs(c.moved) <= 0.5), cells.map((c) => c.moved));
  const rightAligned = cells.filter((c) => c.textAlign === 'right');
  check(
    'a right-aligned cell keeps its text at its right padding',
    rightAligned.length > 0 && rightAligned.every((c) => Math.abs(c.rightGap - c.padRight) <= 0.5),
    rightAligned,
  );
  check('a body cell stays a block box', cells.every((c) => c.display === 'block'), cells.map((c) => c.display));

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

  // A click moves the row by other means and ends the query: from "New Year plan.md", "c" lands on
  // "Cherry.png", and after a click on "new folder", "i" searches for "i" rather than narrowing "ci"
  // to "citrus.csv".
  const typedAt = Date.now();
  await page.keyboard.type('c');
  const onC = await focusedText();
  const newFolder = await page.evaluateHandle(() =>
    [...document.querySelectorAll('[role="row"]')].find((r) => r.textContent.includes('new folder')),
  );
  await newFolder.click();
  await page.keyboard.type('i');
  // Inside the example's 700 ms window, or the query would have ended by itself.
  const elapsed = Date.now() - typedAt;
  const afterClick = await focusedText();
  check(
    'a click ends the type-ahead query, so the next letter starts a new one',
    elapsed < 700 && onC?.includes('Cherry.png') === true && afterClick?.includes('invoice-') === true,
    { onC, afterClick, elapsed },
  );

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
  // The page's first press, so no focus the grid held before can decide whether it shows a ring.
  const ringAfterPress = await mq.evaluate(() => document.querySelector('[role="grid"]').matches(':focus-visible'));
  check('a marquee over four rows selects those four, and the release’s click does not undo it', dragged.join() === '3,4,5,6', dragged);
  check(
    'the rectangle shows in its colours while dragged, and goes at the release',
    during.display === 'block' && during.fill !== 'rgba(0, 0, 0, 0)' && during.height > 0 && afterRelease.display === 'none',
    { during, afterRelease },
  );
  check('the grid keeps keyboard focus after a marquee', focusOnGrid);
  check('a marquee press focuses the grid without the keyboard focus ring', focusOnGrid && !ringAfterPress, {
    ringAfterPress,
  });

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
  const scrollWidthOf = () =>
    narrow.evaluate(
      () => [...document.querySelectorAll('[role="grid"] div')].find((d) => getComputedStyle(d).overflowX === 'auto').scrollWidth,
    );
  const heldFrom = await scrollWidthOf();
  const pb = await (await narrow.$('[data-table-resize="name"]')).boundingBox();
  await narrow.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await narrow.mouse.down();
  await narrow.mouse.move(pb.x + pb.width / 2 - 20, pb.y + pb.height / 2, { steps: 4 });
  await new Promise((r) => setTimeout(r, 200));
  const heldAt = await scrollWidthOf();
  await narrow.mouse.up();
  await new Promise((r) => setTimeout(r, 100));
  const released = await narrow.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    const s = [...grid.querySelectorAll('div')].find((d) => getComputedStyle(d).overflowX === 'auto');
    const cells = [...grid.querySelectorAll('[role="rowgroup"] [role="row"][aria-rowindex="2"] [role="gridcell"]')];
    const r = s.getBoundingClientRect();
    return { scrollport: r.left + s.clientLeft + s.clientWidth, lastCell: cells[cells.length - 1].getBoundingClientRect().right };
  });
  const wq = await nameWidth();
  const after2 = await scrollerOf();
  check('scrolled to the end, the scroll was pinned there', pinned.left > 0, { scrollLeft: pinned.left });
  check('a held border drag keeps the content as wide as at the press, no wider', heldAt === heldFrom, {
    heldFrom,
    heldAt,
  });
  check(
    'released at the end, the narrower content leaves no blank space past its last cell',
    Math.abs(released.lastCell - released.scrollport) <= 0.5,
    released,
  );
  check(
    'and a border dragged 20 px left shrinks its column by 20',
    Math.abs(wp - 20 - wq) <= 1 && after2.left > 0,
    { before: wp, after: wq, scrollLeft: after2.left },
  );
  await narrow.close();

  // The horizontal end with an empty reserved gutter, which this run's hidden scrollbars leave in
  // every scroller: a 700 px page scrolls horizontally, a 1280 px one does not.
  const gutterPage = await browser.newPage();
  gutterPage.on('pageerror', (e) => errors.push(String(e)));
  const horizontalEnd = async (width) => {
    await gutterPage.setViewport({ width, height: 800 });
    await gutterPage.goto(url, { waitUntil: 'networkidle0' });
    await gutterPage.waitForSelector('[role="grid"] [role="row"][aria-rowindex="2"] [role="gridcell"]');
    await gutterPage.evaluate(() => {
      const s = [...document.querySelector('[role="grid"]').querySelectorAll('div')].find(
        (d) => getComputedStyle(d).overflowX === 'auto',
      );
      s.scrollLeft = s.scrollWidth;
    });
    await new Promise((r) => setTimeout(r, 150));
    return gutterPage.evaluate(() => {
      const grid = document.querySelector('[role="grid"]');
      const s = [...grid.querySelectorAll('div')].find((d) => getComputedStyle(d).overflowX === 'auto');
      const r = s.getBoundingClientRect();
      const cells = [...grid.querySelectorAll('[role="rowgroup"] [role="row"][aria-rowindex="2"] [role="gridcell"]')];
      const heads = [...grid.querySelectorAll('[role="columnheader"]')];
      const right = (el) => el.getBoundingClientRect().right;
      return {
        scrollLeft: s.scrollLeft,
        scrollWidth: s.scrollWidth,
        clientWidth: s.clientWidth,
        scrollport: r.left + s.clientLeft + s.clientWidth,
        lastCell: right(cells[cells.length - 1]),
        lastHeader: right(heads[heads.length - 1]),
        row: right(cells[0].parentElement),
      };
    });
  };
  const narrowEnd = await horizontalEnd(700);
  check(
    'scrolled to its horizontal end past an empty gutter, the last cell meets the scrollport’s edge',
    narrowEnd.scrollLeft > 0 && Math.abs(narrowEnd.lastCell - narrowEnd.scrollport) <= 0.5,
    narrowEnd,
  );
  check(
    'and the header’s last column ends where the row’s does',
    Math.abs(narrowEnd.lastHeader - narrowEnd.lastCell) <= 0.5,
    narrowEnd,
  );
  const wideEnd = await horizontalEnd(1280);
  check(
    'a grid that fits across does not scroll horizontally, and its rows end at the scrollport',
    wideEnd.scrollLeft === 0 && wideEnd.scrollWidth === wideEnd.clientWidth && wideEnd.row === wideEnd.scrollport,
    wideEnd,
  );
  await gutterPage.close();

  // The same end with scrollbars drawn: the vertical one fills the gutter, so nothing is withheld
  // and nothing may be added.
  const drawnBrowser = await puppeteer.launch({
    executablePath,
    headless: true,
    ignoreDefaultArgs: ['--hide-scrollbars'],
    defaultViewport: { width: 700, height: 800 },
  });
  try {
    const drawn = await drawnBrowser.newPage();
    drawn.on('pageerror', (e) => errors.push(String(e)));
    await drawn.goto(url, { waitUntil: 'networkidle0' });
    await drawn.waitForSelector('[role="grid"] [role="row"][aria-rowindex="2"] [role="gridcell"]');
    const end = await drawn.evaluate(async () => {
      const grid = document.querySelector('[role="grid"]');
      const s = [...grid.querySelectorAll('div')].find((d) => getComputedStyle(d).overflowX === 'auto');
      s.scrollLeft = s.scrollWidth;
      await new Promise((r) => setTimeout(r, 150));
      const cells = [...grid.querySelectorAll('[role="rowgroup"] [role="row"][aria-rowindex="2"] [role="gridcell"]')];
      const r = s.getBoundingClientRect();
      return {
        gutter: s.offsetWidth - s.clientWidth,
        scrollLeft: s.scrollLeft,
        scrollport: r.left + s.clientLeft + s.clientWidth,
        lastCell: cells[cells.length - 1].getBoundingClientRect().right,
      };
    });
    check(
      'with a scrollbar drawn in the gutter, the horizontal end is the last cell, not past it',
      end.gutter > 0 && end.scrollLeft > 0 && Math.abs(end.lastCell - end.scrollport) <= 0.5,
      end,
    );
  } finally {
    await drawnBrowser.close();
  }

  // The same grid drawn at half size by a transform on the grid, against itself unscaled.
  const scaled = await browser.newPage();
  scaled.on('pageerror', (e) => errors.push(String(e)));
  await scaled.goto(url, { waitUntil: 'networkidle0' });
  await scaled.waitForSelector('[role="grid"] [data-table-header]');
  const geometry = async () => {
    // The one-px scroll renders nothing; Home's focus change is the render that measures again.
    await scaled.evaluate(() => {
      const s = [...document.querySelector('[role="grid"]').querySelectorAll('div')].find(
        (d) => getComputedStyle(d).overflowY === 'auto',
      );
      s.scrollTop = s.scrollTop === 1 ? 2 : 1;
    });
    await new Promise((r) => setTimeout(r, 150));
    await scaled.focus('[role="grid"]');
    await scaled.keyboard.press('Home');
    await scaled.keyboard.press('PageDown');
    const { step, offsetHeight, overlap, drawn } = await drawnRows(scaled);
    const { canvas, paged } = await scaled.evaluate(() => {
      const grid = document.querySelector('[role="grid"]');
      const id = grid.getAttribute('aria-activedescendant');
      return {
        canvas: Number.parseFloat(grid.querySelector('[role="presentation"]').style.height),
        paged: Number(document.getElementById(id)?.getAttribute('aria-rowindex')),
      };
    });
    return { step, offsetHeight, overlap, drawn, canvas, paged };
  };
  const plain = await geometry();
  await scaled.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    grid.style.transform = 'scale(0.5)';
    grid.style.transformOrigin = '0 0';
  });
  const half = await geometry();
  check('unscaled, rows are exactly one row’s offsetHeight apart', plain.step === plain.offsetHeight, plain);
  // Within 0.05 px a row: a whole-px `offsetHeight` bounds the scale's precision,
  // `docs/map/territory/row-windowing.md`.
  check(
    'inside scale(0.5), rows are a whole layout row apart and do not overlap on screen',
    Math.abs(half.step - half.offsetHeight) <= 0.05 && Math.abs(half.overlap) <= 0.05,
    half,
  );
  check(
    'inside scale(0.5), the window, the canvas and the page are the unscaled ones',
    half.drawn === plain.drawn &&
      Math.abs(half.canvas / plain.canvas - 1) <= 0.05 / plain.step &&
      half.paged === plain.paged,
    { plain, half },
  );

  // A marquee in the scaled copy, pressed and released on each row's third cell, away from the name.
  /** Scrolls the scaled grid to `fraction` of its scroll range, waits for the redraw, and answers the
   * first row wholly in view. */
  const scrollScaledTo = async (fraction) => {
    await scaled.evaluate((f) => {
      const s = [...document.querySelector('[role="grid"]').querySelectorAll('div')].find(
        (d) => getComputedStyle(d).overflowY === 'auto',
      );
      s.scrollTop = (s.scrollHeight - s.clientHeight) * f;
    }, fraction);
    await new Promise((r) => setTimeout(r, 150));
    return scaled.evaluate(() => {
      const s = [...document.querySelector('[role="grid"]').querySelectorAll('div')].find(
        (d) => getComputedStyle(d).overflowY === 'auto',
      );
      const box = s.getBoundingClientRect();
      const inView = [...s.querySelectorAll('[role="row"][aria-rowindex]')]
        .filter((r) => r.getBoundingClientRect().top >= box.top)
        .map((r) => Number(r.getAttribute('aria-rowindex')));
      return { scrollTop: s.scrollTop, first: Math.min(...inView) };
    });
  };
  const cellCentre = (rowIndex) =>
    scaled.$eval(`[role="grid"] [role="row"][aria-rowindex="${rowIndex}"]`, (r) => {
      const b = r.querySelectorAll('[role="gridcell"]')[2].getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
  const scaledSelected = () =>
    scaled.$$eval('[role="row"][aria-selected="true"]', (rs) => rs.map((r) => Number(r.getAttribute('aria-rowindex'))));
  const scaledDrag = async (from, to) => {
    const a = await cellCentre(from);
    const b = await cellCentre(to);
    await scaled.mouse.move(a.x, a.y);
    await scaled.mouse.down();
    await scaled.mouse.move(b.x, b.y, { steps: 6 });
    const shown = await scaled.$eval('[data-table-marquee]', (m) => getComputedStyle(m).display);
    await scaled.mouse.up();
    return { shown, selected: await scaledSelected(), a, b };
  };
  await scrollScaledTo(0);
  const halfDrag = await scaledDrag(3, 6);
  check(
    'inside scale(0.5), a marquee over four rows selects those four',
    halfDrag.shown === 'block' && halfDrag.selected.join() === '3,4,5,6',
    halfDrag,
  );
  const deep = await scrollScaledTo(0.95);
  const deepDrag = await scaledDrag(deep.first + 2, deep.first + 5);
  const deepRows = [2, 3, 4, 5].map((n) => deep.first + n).join();
  check(
    'inside scale(0.5), scrolled near the end, a marquee over four rows selects those four',
    deep.scrollTop > 100_000 && deepDrag.shown === 'block' && deepDrag.selected.join() === deepRows,
    { deep, deepDrag },
  );

  // The scroller capped at 250 layout px, and the grid drawn at twice the size.
  await scaled.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    const s = [...grid.querySelectorAll('div')].find((d) => getComputedStyle(d).overflowY === 'auto');
    s.style.maxHeight = '250px';
    grid.style.transform = 'scale(2)';
  });
  await scrollScaledTo(0);
  // The rows below the view's top plus its layout height, and inside the view on screen.
  const band = await scaled.evaluate(() => {
    const s = [...document.querySelector('[role="grid"]').querySelectorAll('div')].find(
      (d) => getComputedStyle(d).overflowY === 'auto',
    );
    const box = s.getBoundingClientRect();
    const unconverted = box.top + s.clientTop + s.clientHeight;
    const rows = [...s.querySelectorAll('[role="row"][aria-rowindex]')]
      .map((r) => ({ index: Number(r.getAttribute('aria-rowindex')), b: r.getBoundingClientRect() }))
      .filter(({ b }) => b.top > unconverted && b.bottom < Math.min(innerHeight, box.bottom) - 4)
      .map(({ index }) => index)
      .sort((x, y) => x - y);
    return { rows, unconverted, viewBottom: box.bottom, innerHeight };
  });
  const lowRow = band.rows[0];
  const doubleDrag = band.rows.length < 2 ? null : await scaledDrag(lowRow, lowRow + 1);
  check(
    'inside scale(2), a press low in the view on screen starts a marquee over the rows dragged',
    doubleDrag !== null && doubleDrag.shown === 'block' && doubleDrag.selected.join() === `${lowRow},${lowRow + 1}`,
    { band, doubleDrag },
  );

  // Under scale(0.83), deep in the list: `docs/map/territory/verification-gates.md`.
  const beforeScaled = errors.length;
  await scaled.evaluate(() => {
    document.querySelector('[role="grid"]').style.transform = 'scale(0.83)';
  });
  const inexact = [];
  // A throw here is the check's to report: `docs/map/territory/verification-gates.md`.
  let sweepThrew = null;
  try {
    for (const fraction of [0, 0.25, 0.5, 0.75, 0.97]) {
      await scrollScaledTo(fraction);
      const { step, offsetHeight } = await drawnRows(scaled);
      inexact.push({ step, offsetHeight });
    }
  } catch (e) {
    sweepThrew = String(e);
  }
  check(
    'inside scale(0.83), a deep scroll raises no error and rows stay at the unscaled step',
    sweepThrew === null &&
      errors.length === beforeScaled &&
      inexact.length === 5 &&
      inexact.every((r) => r.step === r.offsetHeight),
    { sweepThrew, raised: errors.slice(beforeScaled), inexact },
  );
  await scaled.close();

  // Below a leading `..` row: the focused row is revealed whole, counted from the canvas (#46).
  const lead = await browser.newPage();
  lead.on('pageerror', (e) => errors.push(String(e)));
  await lead.goto(`${url}?leading=1`, { waitUntil: 'networkidle0' });
  await lead.waitForSelector('[role="grid"] [data-parent-row]');
  /** Presses `key` on the grid and answers where the focused row and the `..` row sit in the view. */
  const revealAfter = async (key) => {
    await lead.focus('[role="grid"]');
    await lead.keyboard.press(key);
    await new Promise((r) => setTimeout(r, 150));
    // Read in layout px: `docs/map/territory/verification-gates.md`.
    return lead.evaluate(() => {
      const grid = document.querySelector('[role="grid"]');
      const s = [...grid.querySelectorAll('div')].find((d) => getComputedStyle(d).overflowY === 'auto');
      const canvas = s.querySelector('[role="presentation"]');
      const parent = s.querySelector('[data-parent-row]');
      const canvasTop = canvas.offsetTop - s.offsetTop - s.clientTop;
      const focused = document.getElementById(grid.getAttribute('aria-activedescendant'));
      const rowTop = focused ? canvasTop + Number.parseFloat(focused.style.top) : null;
      const viewBottom = s.scrollTop + s.clientHeight;
      const parentTop = parent.offsetTop - s.offsetTop - s.clientTop;
      return {
        scrollTop: s.scrollTop,
        atEnd: s.scrollTop >= s.scrollHeight - s.clientHeight - 1,
        canvasTop,
        rowIndex: Number(focused?.getAttribute('aria-rowindex')),
        topGap: rowTop === null ? null : rowTop - s.scrollTop,
        bottomGap: rowTop === null ? null : viewBottom - (rowTop + focused.offsetHeight),
        parentShown: parentTop >= s.scrollTop && parentTop + parent.offsetHeight <= viewBottom,
      };
    });
  };
  const leadEnd = await revealAfter('End');
  check(
    'below a leading row, End brings the last row’s bottom to the view’s bottom',
    leadEnd.bottomGap !== null && Math.abs(leadEnd.bottomGap) <= 0.5,
    leadEnd,
  );
  const leadHome = await revealAfter('Home');
  check(
    'below a leading row, Home scrolls to the very top and shows the leading row',
    leadHome.scrollTop === 0 && leadHome.parentShown && leadHome.rowIndex === 3,
    leadHome,
  );
  // Under scale(0.5), deep in the list and short of its end: `docs/map/territory/verification-gates.md`.
  await lead.evaluate(() => {
    const grid = document.querySelector('[role="grid"]');
    grid.style.transform = 'scale(0.5)';
    grid.style.transformOrigin = '0 0';
  });
  await revealAfter('Home');
  await revealAfter('End');
  await revealAfter('PageUp');
  const leadScaled = await revealAfter('PageUp');
  check(
    'below a leading row inside scale(0.5), PageUp deep in the list brings the row’s top to the view’s top',
    leadScaled.topGap !== null && Math.abs(leadScaled.topGap) <= 0.5 && !leadScaled.atEnd,
    leadScaled,
  );
  await lead.close();

  // The row height under each box model, on rows restyled in place: `docs/map/territory/verification-gates.md`.
  const boxed = await browser.newPage();
  boxed.on('pageerror', (e) => errors.push(String(e)));
  await boxed.goto(url, { waitUntil: 'networkidle0' });
  await boxed.waitForSelector('[role="grid"] [data-table-header]');
  /**
   * Gives every `.row` the declarations `css`, has the grid render so it measures, and answers the
   * row step with the row's `offsetHeight` and computed `height`.
   */
  const rowUnder = async (css) => {
    await boxed.evaluate((css) => {
      let sheet = document.getElementById('check-row-box');
      if (!sheet) {
        sheet = document.createElement('style');
        sheet.id = 'check-row-box';
        document.head.append(sheet);
      }
      sheet.textContent = `[role="grid"] .row { ${css} }`;
    }, css);
    await boxed.focus('[role="grid"]');
    await boxed.keyboard.press('Home');
    await boxed.keyboard.press('PageDown');
    await new Promise((r) => setTimeout(r, 150));
    const { step, offsetHeight, computed } = await drawnRows(boxed);
    return { step, offsetHeight, computed };
  };
  const borderBox = await rowUnder(
    'box-sizing: border-box; height: 32.5px; padding: 6px 0 2px; border-bottom: 1px solid currentColor',
  );
  check(
    'a border-box row with padding and a border is placed at its height, not its height plus them',
    borderBox.step === 32.5 && Math.abs(borderBox.offsetHeight - 32.5) < 1,
    borderBox,
  );
  const contentBox = await rowUnder(
    'box-sizing: content-box; height: 20.5px; padding: 6px 0 2px; border-top: 2px solid currentColor; border-bottom: 1px solid currentColor',
  );
  check(
    'a content-box row is placed at its height plus its padding and borders',
    contentBox.step === 31.5 && Math.abs(contentBox.offsetHeight - 31.5) < 1,
    contentBox,
  );
  await boxed.close();

  check('no page errors', errors.length === 0, errors);
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed in ${executablePath}`);
process.exitCode = failed === 0 && results.length > 0 ? 0 : 1;
// Ends the run with the same code if a handle is still open five seconds on.
setTimeout(() => process.exit(), 5000).unref();
