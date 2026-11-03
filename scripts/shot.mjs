#!/usr/bin/env node
/**
 * Drives the site in real Chrome with hardware WebGL: load a page, run a script
 * of key presses and clicks, take screenshots, measure frame rate, and print
 * every console error. This is how the 3D world gets checked, because a build
 * that type-checks can still render nothing.
 *
 *   node scripts/shot.mjs --url "/lab?only=core" --out shot.png
 *   node scripts/shot.mjs --url / --out a.png --fps
 *   node scripts/shot.mjs --url / --steps '[{"press":"w","ms":2500},{"shot":"b.png"}]'
 *
 * Options
 *   --url      Path or full URL. Paths resolve against $BASE_URL or localhost:3000.
 *   --out      Final screenshot path. Omit to skip it.
 *   --size     Viewport, default 1672x941 (the reference image).
 *   --wait     Milliseconds to settle after the scene reports ready. Default 1500.
 *   --timeout  Milliseconds to wait for the scene to report ready. Default 60000.
 *   --steps    JSON array of steps, run in order:
 *                {"press":"w","ms":1000}   hold a key
 *                {"tap":"e"}               press and release
 *                {"wait":500}              sleep
 *                {"click":[x,y]}           left click in viewport pixels
 *                {"drag":[x1,y1,x2,y2]}    left drag
 *                {"wheel":-300}            scroll wheel
 *                {"shot":"path.png"}       screenshot
 *                {"eval":"js expression"}  evaluate in the page and print JSON
 *   --fps      Measure rendered frames per second for three seconds and print it.
 *   --no-wait-ready  Do not wait for the scene (for pages without one).
 *   --mobile   Emulate a touch device.
 *
 * Exit code is 1 if the page threw an error or logged one with console.error.
 */

import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) options[key] = true;
    else {
      options[key] = next;
      i += 1;
    }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const url = String(options.url ?? '/');
const target = url.startsWith('http') ? url : `${BASE}${url.startsWith('/') ? '' : '/'}${url}`;
const [width, height] = String(options.size ?? '1672x941').split('x').map(Number);
const settle = Number(options.wait ?? 1500);
const timeout = Number(options.timeout ?? 60000);
const steps = options.steps ? JSON.parse(String(options.steps)) : [];

const problems = [];

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'],
});

const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  hasTouch: Boolean(options.mobile),
  isMobile: Boolean(options.mobile),
});
const page = await context.newPage();

page.on('pageerror', (error) => {
  problems.push(`pageerror: ${error.message}`);
  console.log(`[pageerror] ${error.message}`);
});
page.on('console', (message) => {
  if (message.type() === 'error') {
    problems.push(`console.error: ${message.text()}`);
    console.log(`[console.error] ${message.text().slice(0, 600)}`);
  } else if (message.type() === 'warning' && options.warnings) {
    console.log(`[warning] ${message.text().slice(0, 300)}`);
  }
});

try {
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 120000 });

  if (!options['no-wait-ready']) {
    await page
      .waitForFunction(() => window.__universe?.store.getState().ready === true, null, { timeout })
      .catch(() => {
        problems.push(`scene did not report ready within ${timeout}ms`);
        console.log(`[timeout] scene did not report ready within ${timeout}ms`);
      });
  }

  await page.waitForTimeout(settle);

  for (const step of steps) {
    if (step.press) {
      await page.keyboard.down(step.press);
      await page.waitForTimeout(step.ms ?? 500);
      await page.keyboard.up(step.press);
    } else if (step.tap) {
      await page.keyboard.press(step.tap);
    } else if (step.wait) {
      await page.waitForTimeout(step.wait);
    } else if (step.click) {
      await page.mouse.click(step.click[0], step.click[1]);
    } else if (step.drag) {
      const [x1, y1, x2, y2] = step.drag;
      await page.mouse.move(x1, y1);
      await page.mouse.down();
      await page.mouse.move(x2, y2, { steps: 12 });
      await page.mouse.up();
    } else if (step.wheel) {
      await page.mouse.wheel(0, step.wheel);
    } else if (step.shot) {
      await page.screenshot({ path: step.shot });
      console.log(`[shot] ${step.shot}`);
    } else if (step.eval) {
      const value = await page.evaluate(step.eval);
      console.log(`[eval] ${JSON.stringify(value)}`);
    }
  }

  if (options.fps) {
    const result = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const start = performance.now();
          const stamps = [];
          const tick = (now) => {
            stamps.push(now);
            if (now - start < 3000) requestAnimationFrame(tick);
            else {
              const gaps = stamps.slice(1).map((value, index) => value - stamps[index]);
              gaps.sort((a, b) => a - b);
              const info = window.__universe?.three?.gl?.info?.render;
              resolve({
                fps: Number((1000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)).toFixed(1)),
                p95FrameMs: Number((gaps[Math.floor(gaps.length * 0.95)] ?? 0).toFixed(1)),
                drawCalls: info?.calls,
                triangles: info?.triangles,
              });
            }
          };
          requestAnimationFrame(tick);
        }),
    );
    console.log(`[fps] ${JSON.stringify(result)}`);
  }

  if (options.out) {
    await page.screenshot({ path: String(options.out) });
    console.log(`[shot] ${options.out}`);
  }
} finally {
  await browser.close();
}

if (problems.length) {
  console.log(`[problems] ${problems.length}`);
  process.exitCode = 1;
}
