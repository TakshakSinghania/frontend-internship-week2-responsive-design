// Generates the landscape illustrations used on the page as responsive WebP files.
// Each scene is drawn as SVG at the requested aspect ratio (so wide and tall crops are composed
// separately, not just cropped) and then rasterised at several widths for srcset.
// Usage: npm run images
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../assets/img/', import.meta.url));

// Small deterministic PRNG so the same seed always draws the same ridgelines.
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function ridge(w, h, base, amp, steps, rand) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = (w / steps) * i;
    const y = h * base - rand() * amp * h;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M0,${h} L${pts.join(' L')} L${w},${h} Z`;
}

function trees(w, h, base, count, color, rand) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const th = h * (0.05 + rand() * 0.06);
    const y = h * base + rand() * h * 0.06;
    s += `<path d="M${x},${y - th} L${x - th * 0.3},${y} L${x + th * 0.3},${y} Z" fill="${color}"/>`;
  }
  return s;
}

function scene({ w, h, seed, sky, sun, ridges, tree, lake }) {
  const rand = rng(seed);
  const layers = ridges.map((r) => `<path d="${ridge(w, h, r.base, r.amp, r.steps, rand)}" fill="${r.color}"/>`).join('');
  const sunEl = `<circle cx="${w * sun.x}" cy="${h * sun.y}" r="${Math.min(w, h) * sun.r}" fill="${sun.color}"/>`;
  const lakeEl = lake ? `<rect x="0" y="${h * lake.y}" width="${w}" height="${h * (1 - lake.y)}" fill="${lake.color}"/><rect x="0" y="${h * lake.y}" width="${w}" height="${h * 0.006}" fill="#ffffff" opacity=".35"/>` : '';
  const treeEl = tree ? trees(w, h, tree.base, tree.count, tree.color, rand) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#s)"/>${sunEl}${layers}${lakeEl}${treeEl}</svg>`;
}

const palettes = {
  dawn: { sky: ['#f4c78e', '#f7e6cf'], sun: { x: 0.72, y: 0.34, r: 0.09, color: '#fbe3b9' }, ridges: [
    { base: 0.62, amp: 0.3, steps: 9, color: '#b8a3a8' }, { base: 0.75, amp: 0.22, steps: 12, color: '#7d7389' },
    { base: 0.86, amp: 0.16, steps: 16, color: '#3f4a5c' }], tree: { base: 0.9, count: 40, color: '#1f2a33' } },
  alpine: { sky: ['#8fb8d6', '#e3eef4'], sun: { x: 0.2, y: 0.25, r: 0.07, color: '#ffffff' }, ridges: [
    { base: 0.55, amp: 0.35, steps: 7, color: '#dfe7ec' }, { base: 0.7, amp: 0.25, steps: 11, color: '#7a95a6' },
    { base: 0.84, amp: 0.14, steps: 15, color: '#2f5d45' }], tree: { base: 0.88, count: 55, color: '#1f3d2b' } },
  lake: { sky: ['#a7c6c9', '#eef2ea'], sun: { x: 0.5, y: 0.3, r: 0.08, color: '#fdf6e3' }, ridges: [
    { base: 0.5, amp: 0.25, steps: 8, color: '#9fb3b0' }, { base: 0.6, amp: 0.18, steps: 12, color: '#5d7f74' }],
    lake: { y: 0.62, color: '#6f9a9a' }, tree: { base: 0.6, count: 45, color: '#244436' } },
  dusk: { sky: ['#3b3f6b', '#d98c6a'], sun: { x: 0.35, y: 0.62, r: 0.1, color: '#f4b37a' }, ridges: [
    { base: 0.66, amp: 0.28, steps: 8, color: '#6b4f6e' }, { base: 0.8, amp: 0.2, steps: 13, color: '#3e3352' },
    { base: 0.92, amp: 0.1, steps: 18, color: '#1d1a2b' }] },
  desert: { sky: ['#e9b872', '#f6e7c8'], sun: { x: 0.8, y: 0.28, r: 0.06, color: '#fff4dc' }, ridges: [
    { base: 0.65, amp: 0.2, steps: 6, color: '#d39b62' }, { base: 0.78, amp: 0.14, steps: 9, color: '#b06f3c' },
    { base: 0.9, amp: 0.08, steps: 12, color: '#7a4628' }] },
  forest: { sky: ['#cfe0c3', '#f1f4e8'], sun: { x: 0.65, y: 0.22, r: 0.05, color: '#ffffff' }, ridges: [
    { base: 0.58, amp: 0.22, steps: 10, color: '#a6bf95' }, { base: 0.72, amp: 0.18, steps: 14, color: '#5f8a55' },
    { base: 0.86, amp: 0.12, steps: 18, color: '#2f5d45' }], tree: { base: 0.82, count: 90, color: '#1b3526' } },
};

// name, palette, seed, aspect (w/h), output widths
const images = [
  ['hero-wide', 'dawn', 7, 16 / 7, [960, 1600, 2400]],
  ['hero-tall', 'dawn', 7, 4 / 5, [480, 800]],
  ['trek-hampta', 'alpine', 11, 3 / 2, [480, 800]],
  ['trek-tarsar', 'lake', 23, 3 / 2, [480, 800]],
  ['trek-kedarkantha', 'forest', 5, 3 / 2, [480, 800]],
  ['trek-spiti', 'desert', 31, 3 / 2, [480, 800]],
  ['trek-sandakphu', 'dusk', 17, 3 / 2, [480, 800]],
  ['gallery-1', 'alpine', 41, 1, [400, 800]],
  ['gallery-2', 'dusk', 43, 1, [400, 800]],
  ['gallery-3', 'lake', 47, 1, [400, 800]],
  ['gallery-4', 'forest', 53, 1, [400, 800]],
  ['gallery-5', 'desert', 59, 1, [400, 800]],
  ['gallery-6', 'dawn', 61, 1, [400, 800]],
];

await mkdir(out, { recursive: true });
for (const [name, pal, seed, aspect, widths] of images) {
  const w = 1200;
  const h = Math.round(w / aspect);
  const svg = Buffer.from(scene({ w, h, seed, ...palettes[pal] }));
  for (const width of widths) {
    const file = `${out}${name}-${width}.webp`;
    const info = await sharp(svg, { density: 72 * (width / w) * 2 }).resize(width).webp({ quality: 78 }).toFile(file);
    console.log(`${name}-${width}.webp  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} KB`);
  }
}
