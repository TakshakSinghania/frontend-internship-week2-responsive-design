# Testing — Week 2 (Northwind Trails responsive page)

## Environment

| Item | Version / detail |
|------|------------------|
| OS | macOS (Darwin 27.0) |
| Node.js | 26.8.2 |
| Automated browser | Google Chrome 156.0.8078.47 headless via puppeteer-core 25.16.0 |
| Manual browser | Built-in Chromium browser pane of the Claude desktop app, with device emulation |
| Validators | html-validate 11.17.0 (`recommended`), csstree-validator 4.0.1 |

## Tests executed

### Static analysis (automated)

| Check | Result |
|-------|--------|
| `html-validate index.html` | **Pass**, 0 errors |
| `csstree-validator css/styles.css` | **Pass**, 0 errors |

### Responsive checks (automated, `tests/responsive-check.mjs`)

For each viewport the test loads the page, scrolls through it so lazy images load, then reads computed styles from Chrome.

| Viewport | Overflow | Images | Header | Treks | Featured card | Timeline | Plans | Gallery | Stories | Footer |
|----------|----------|--------|--------|-------|---------------|----------|-------|---------|---------|--------|
| 320×640 | 0 px ✅ | 12/12 ✅ | static, swipe nav | 1 | stacked | vertical | 1 | 2 | swipe row | 1 |
| 375×812 | 0 px ✅ | 12/12 ✅ | static, swipe nav | 1 | stacked | vertical | 1 | 2 | swipe row | 1 |
| 375×812 @2× | 0 px ✅ | 12/12 ✅ | static, swipe nav | 1 | stacked | vertical | 1 | 2 | swipe row | 1 |
| 768×1024 | 0 px ✅ | 12/12 ✅ | static, swipe nav | 2 | side by side | vertical | 1 | 2 | swipe row | 2 |
| 1024×768 | 0 px ✅ | 12/12 ✅ | sticky row | 2 | side by side | vertical | 3 | 4 | 3-col grid | 2 |
| 1440×900 | 0 px ✅ | 12/12 ✅ | sticky row | 3 | side by side | 5 across | 3 | 4 | 3-col grid | 4 |
| 1920×1080 | 0 px ✅ | 12/12 ✅ | sticky row | 3 | side by side | 5 across | 3 | 4 | 3-col grid | 4 |

| Viewport | body / h1 / h2 px | Hero file chosen | Card file chosen | Hero height | Hero CTA on first screen | Smallest target | Console/HTTP errors |
|----------|-------------------|------------------|------------------|-------------|--------------------------|-----------------|---------------------|
| 320×640 | 16 / 36 / 28 | hero-tall-480 | trek-tarsar-480 | 558 px | ✅ | 44 px ✅ | 0 |
| 375×812 | 16.1 / 38.2 / 28.3 | hero-tall-480 | trek-tarsar-480 | 623 px | ✅ | 44 px ✅ | 0 |
| 375×812 @2× | 16.1 / 38.2 / 28.3 | hero-tall-800 | trek-tarsar-800 | 623 px | ✅ | 44 px ✅ | 0 |
| 768×1024 | 16.9 / 54.7 / 36.2 | hero-tall-800 | trek-tarsar-480 | 560 px | ✅ | 44 px ✅ | 0 |
| 1024×768 | 17.4 / 65.4 / 41.3 | hero-wide-1600 | trek-tarsar-480 | 576 px | ✅ | 44 px ✅ | 0 |
| 1440×900 | 18 / 72 / 44 | hero-wide-1600 | trek-tarsar-480 | 634 px | ✅ | 44 px ✅ | 0 |
| 1920×1080 | 18 / 72 / 44 | hero-wide-2400 | trek-tarsar-480 | 768 px | ✅ | 44 px ✅ | 0 |

Every in-page link pointed to an existing id at every viewport. The test fails if any of these hold: overflow > 0, a broken image, a missing anchor, a target < 44 px, the hero CTA below the first screen, or a console/HTTP error.

### Measurements (automated, one-off Puppeteer scripts)

| Measurement | Result |
|-------------|--------|
| WebP bytes downloaded after scrolling the whole page, cache disabled | 375@1×: 36.4 KB · 375@2×: 60.7 KB · 768: 51.1 KB · 1440: 50.7 KB · 1920: 57.8 KB |
| Keyboard scrolling of the focused story row at 375 px | ArrowRight: 0 → 308 → 564 px (end); ArrowLeft: back to 308 px ✅ |

### Manual checks (built-in browser)

| Check | Result |
|-------|--------|
| Visual review of every section at 1440×900 | Pass |
| Visual review at 375×812 (mobile emulation) | Pass after fixes 3–4 |
| Visual review at 768×1024 (tablet emulation) | Pass after fix 1 |
| FAQ item opens with Enter on the focused summary | Pass |
| Arrow-key scrolling of the story row in the browser pane | Not confirmed there (the emulated key presses did not reach the page); confirmed in headless Chrome instead (see above) |

## Defects found and fixed

| # | Defect | Fix |
|---|--------|-----|
| 1 | At 768×1024 the hero was ~960 px tall (the 4:5 image set its height) and the CTA fell below the first screen | Hero image absolutely positioned with `object-fit: cover`; height now comes from content/min-height (560 px) |
| 2 | At 320×640 the hero CTA was below the first screen | `@media (max-height: 40em)` reduces hero padding (hero now 558 px) |
| 3 | Mobile hero overlay hid most of the illustration | Lighter gradient and more top padding |
| 4 | "Most booked" badge stretched across the card | `align-self: flex-start` |
| 5 | Test harness: lazy images never loaded because smooth scrolling slowed the test's scroll steps | Test sets `scroll-behavior: auto` before scrolling |
| 6 | Full-page PNG screenshots were 7.7 MB | Saved as JPEG q80 (3.4 MB) |

## Not tested

- Safari / WebKit (no macOS Safari automation was used) and Firefox
- Physical phones and tablets; only Chrome device emulation was used
- Screen readers
- Lighthouse / Axe audits (Week 4 topic)

## Remaining issues and limitations

- No known layout defects in the tested viewports.
- Swipe-only navigation on phones relies on users noticing the strip scrolls; a scroll hint or menu button could be added.

## Reproduce

```bash
npm install
npm test
```

Manual: `python3 -m http.server 8000`, open <http://localhost:8000>, and use DevTools device mode at 320, 375, 768, 1024, 1440 and 1920 px.
