#!/usr/bin/env node
/**
 * validate_slides.js
 * Visual screenshot capture for Google Slides decks.
 *
 * Usage:
 *   node scripts/validate_slides.js <slides-url-or-id>
 *
 * Screenshot strategy (in order of preference):
 *   1. Chrome CDP  — connects to your existing Chrome on port 9222
 *                    (most accurate rendering, inherits your Google auth)
 *   2. API thumbnails — falls back to gws Slides API + curl download
 *                       (no extra auth needed, 1600px renders)
 *
 * To enable CDP mode, relaunch Chrome with:
 *   chrome.exe --remote-debugging-port=9222
 * Then run this script while Chrome is open and logged into Google.
 *
 * Output: PNG files written to .slide-screenshots/<presId>/
 *         Paths printed to stdout for Claude to read.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

const PRES_ID_REGEX = /\/presentation\/d\/([a-zA-Z0-9_-]+)/;
const OUTPUT_BASE = path.join(__dirname, '..', '.slide-screenshots');
const CDP_URL = 'http://localhost:9222';

// ── helpers ──────────────────────────────────────────────────────────────────

function extractPresId(arg) {
  const match = arg.match(PRES_ID_REGEX);
  return match ? match[1] : arg.trim();
}

const IS_WIN = process.platform === 'win32';

// Build a gws command string with proper JSON quoting per platform.
// On Windows (cmd.exe): wrap JSON args in double-quotes, escape inner double-quotes with \"
// On Unix: wrap JSON args in single-quotes
function gws(...args) {
  const parts = ['gws'];
  for (const arg of args) {
    if (arg.startsWith('{') || arg.startsWith('[')) {
      parts.push(IS_WIN ? `"${arg.replace(/"/g, '\\"')}"` : `'${arg}'`);
    } else {
      parts.push(arg);
    }
  }
  const cmd = parts.join(' ');
  return execSync(cmd, { encoding: 'utf8', shell: true, stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 50 * 1024 * 1024 });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    proto.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
    }).on('error', err => { file.close(); fs.unlinkSync(destPath); reject(err); });
  });
}

function extractTitle(slide) {
  for (const el of slide.pageElements || []) {
    const ph = el?.shape?.placeholder?.type;
    if (ph === 'TITLE' || ph === 'CENTERED_TITLE') {
      let text = '';
      for (const te of el?.shape?.text?.textElements || []) {
        if (te?.textRun?.content) text += te.textRun.content;
      }
      return text.trim().slice(0, 60) || '(no title)';
    }
  }
  return '(no title)';
}

// ── slide data ────────────────────────────────────────────────────────────────

function getSlideIds(presId) {
  const raw = gws(
    'slides', 'presentations', 'get',
    '--params', `{"presentationId": "${presId}"}`,
    '--format', 'json'
  );
  const data = JSON.parse(raw);
  return (data.slides || []).map((s, i) => ({
    objectId: s.objectId,
    index: i + 1,
    title: extractTitle(s),
  }));
}

// ── screenshot via Chrome CDP ─────────────────────────────────────────────────

async function screenshotViaChrome(presId, slides, outputDir) {
  console.log(`Connecting to Chrome on ${CDP_URL}...`);
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  const ctx = contexts.length ? contexts[0] : await browser.newContext();
  const pages = ctx.pages();
  const page = pages.length ? pages[0] : await ctx.newPage();

  await page.setViewportSize({ width: 1600, height: 900 });

  const screenshots = [];
  for (const slide of slides) {
    const url = `https://docs.google.com/presentation/d/${presId}/edit#slide=id.${slide.objectId}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    const filename = `slide-${String(slide.index).padStart(2, '0')}-${slide.objectId}.png`;
    const screenshotPath = path.join(outputDir, filename);

    const canvas = page.locator(
      '.punch-viewer-content, .punch-filmstrip-slide-canvas, [aria-label="Slide"]'
    ).first();

    try {
      if (await canvas.count() > 0) {
        await canvas.screenshot({ path: screenshotPath });
      } else {
        await page.screenshot({ path: screenshotPath, fullPage: false });
      }
    } catch {
      await page.screenshot({ path: screenshotPath, fullPage: false });
    }

    screenshots.push({ ...slide, path: screenshotPath });
    console.log(`  [${slide.index}/${slides.length}] ${slide.title}`);
  }

  await browser.close();
  return screenshots;
}

// ── screenshot via Slides API thumbnails ──────────────────────────────────────

async function screenshotViaAPI(presId, slides, outputDir) {
  console.log('Using Slides API thumbnails (1600px renders)...');
  const screenshots = [];

  for (const slide of slides) {
    try {
      const raw = gws(
        'slides', 'presentations', 'pages', 'getThumbnail',
        '--params', `{"presentationId": "${presId}", "pageObjectId": "${slide.objectId}"}`,
        '--format', 'json'
      );
      const data = JSON.parse(raw.trim());
      const url = data.contentUrl;

      if (url) {
        const filename = `slide-${String(slide.index).padStart(2, '0')}-${slide.objectId}.png`;
        const screenshotPath = path.join(outputDir, filename);
        await downloadFile(url, screenshotPath);
        screenshots.push({ ...slide, path: screenshotPath });
        console.log(`  [${slide.index}/${slides.length}] ${slide.title}`);
      }
    } catch (e) {
      console.error(`  [${slide.index}] FAILED (${slide.title}): ${e.message.slice(0, 80)}`);
    }
  }

  return screenshots;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/validate_slides.js <google-slides-url-or-id>');
    process.exit(1);
  }

  const presId = extractPresId(arg);
  const outputDir = path.join(OUTPUT_BASE, presId);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\nPresentation ID: ${presId}`);
  console.log(`Output:          ${outputDir}\n`);

  console.log('Fetching slide structure...');
  const slides = getSlideIds(presId);
  console.log(`Found ${slides.length} slides\n`);

  let screenshots;
  let method;

  try {
    // Probe CDP without actually connecting yet
    await chromium.connectOverCDP(CDP_URL);
    screenshots = await screenshotViaChrome(presId, slides, outputDir);
    method = 'Chrome CDP (pixel-exact)';
  } catch {
    console.log('Chrome not on port 9222 — using Slides API thumbnails\n');
    screenshots = await screenshotViaAPI(presId, slides, outputDir);
    method = 'Slides API thumbnails (1600px)';
  }

  console.log(`\n=== SCREENSHOTS READY (${method}) ===`);
  console.log(`Total: ${screenshots.length} of ${slides.length} slides captured\n`);
  for (const s of screenshots) {
    console.log(`SLIDE ${s.index} | ${s.title}`);
    console.log(`PATH  ${s.path}`);
    console.log('---');
  }
  console.log('\nRead each PATH above with the Read tool to view and validate.');
}

main().catch(e => {
  console.error('\nFatal error:', e.message);
  process.exit(1);
});
