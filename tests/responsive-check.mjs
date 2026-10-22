// Responsive checks across representative viewports: overflow, images and the srcset candidate chosen,
// layout state of each component, fluid type sizes, touch-target sizes, console/HTTP errors.
// Usage: node tests/responsive-check.mjs [--screenshots]   (set CHROME_PATH if Chrome is elsewhere)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const viewports = [
  { width: 320, height: 640 }, { width: 375, height: 812 }, { width: 375, height: 812, dpr: 2 },
  { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 },
];
const takeShots = process.argv.includes('--screenshots');

const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(root, path.endsWith('/') ? path + 'index.html' : path));
    res.writeHead(200, { 'Content-Type': types[extname(path) || '.html'] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const failures = [];
const rows = [];

for (const vp of viewports) {
  const label = `${vp.width}${vp.dpr ? `@${vp.dpr}x` : ''}`;
  const page = await browser.newPage();
  const problems = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.url()}`));
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr || 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });

  // scroll through the page so lazy-loaded images load, then wait for all of them
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = "auto"; // smooth scrolling would outlast the loop
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), { timeout: 10000 });

  const r = await page.evaluate(() => {
    const cols = (sel) => {
      const v = getComputedStyle(document.querySelector(sel)).gridTemplateColumns;
      return v === 'none' ? 1 : v.split(' ').length;
    };
    const file = (sel) => document.querySelector(sel).currentSrc.split('/').pop();
    const px = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
    const targets = [...document.querySelectorAll('.primary-nav a, .btn, .faq-list summary')]
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.width > 0);
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      broken: [...document.images].filter((i) => i.naturalWidth === 0).map((i) => i.currentSrc),
      missingAnchors: [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href').slice(1)).filter((id) => id && !document.getElementById(id)),
      header: getComputedStyle(document.querySelector('.site-header')).position,
      navScrolls: getComputedStyle(document.querySelector('.primary-nav')).overflowX === 'auto',
      hero: file('.hero img'),
      trekImg: file('.trek-item:nth-child(2) img'),
      features: cols('.feature-grid'),
      treks: cols('.trek-grid'),
      featuredCard: cols('.trek-item-featured .trek-card') === 2 ? 'side-by-side' : 'stacked',
      timeline: cols('.timeline'),
      plans: cols('.plan-grid'),
      gallery: cols('.gallery'),
      stories: getComputedStyle(document.querySelector('.stories')).display === 'flex' ? 'swipe row' : `${cols('.stories')}-col grid`,
      footer: cols('.footer-grid'),
      body: px('body'), h1: px('h1'), h2: px('h2'),
      heroHeight: Math.round(document.querySelector(".hero").getBoundingClientRect().height),
      ctaInFirstScreen: document.querySelector(".hero .btn").getBoundingClientRect().bottom <= window.innerHeight,
      minTarget: Math.min(...targets.map((b) => b.height)),
    };
  });

  if (r.overflow > 0) failures.push(`${label}: horizontal overflow ${r.overflow}px`);
  if (r.broken.length) failures.push(`${label}: broken images ${r.broken.join(', ')}`);
  if (r.missingAnchors.length) failures.push(`${label}: links to missing ids ${r.missingAnchors.join(', ')}`);
  if (!r.ctaInFirstScreen) failures.push(`${label}: hero call-to-action is below the first screen`);
  if (r.minTarget < 44) failures.push(`${label}: touch target only ${r.minTarget}px tall`);
  problems.forEach((p) => failures.push(`${label}: ${p}`));
  rows.push({ viewport: label, ...r, broken: r.broken.length, missingAnchors: r.missingAnchors.length, errors: problems.length });

  if (takeShots && !vp.dpr) {
    await page.screenshot({ path: join(root, `docs/screenshots/page-${vp.width}.jpg`), type: 'jpeg', quality: 80, fullPage: true });
  }
  await page.close();
}

await browser.close();
server.close();
console.table(rows);
if (failures.length) {
  console.error('\nFAILED:\n' + failures.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log('\nAll responsive checks passed.');
