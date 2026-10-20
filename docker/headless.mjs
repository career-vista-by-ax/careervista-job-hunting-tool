import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateBatch(input) {
  if (!input || !Array.isArray(input.pages) || !input.pages.length || input.pages.length > 100) throw new Error('Supply 1–100 approved pages.');
  const keys = new Set();
  return input.pages.map(item => {
    if (!item || typeof item.key !== 'string' || !/^[\w-]{1,128}$/.test(item.key) || keys.has(item.key)) throw new Error('Use unique opaque work keys.');
    keys.add(item.key);
    const url = new URL(item.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use approved public HTTPS URLs without credentials.');
    if (item.waitFor !== undefined && (typeof item.waitFor !== 'string' || !item.waitFor.trim() || item.waitFor.length > 500)) throw new Error('waitFor must be a short observed CSS selector.');
    return { key: item.key, url: url.href, ...(item.waitFor ? { waitFor: item.waitFor } : {}) };
  });
}

// These signals request human review; their absence never proves a page is genuine.
export function accessStatus({ status, url, title, text, password }) {
  if (status === 429) return 'rate-limited';
  const visible = `${title}\n${text.slice(0, 12000)}`;
  if (/captcha|verify (?:that )?you are (?:a )?human|checking your browser|unusual traffic|automated (?:access|requests)|access denied|pardon (?:our|the) interruption|just a moment/i.test(visible)) return 'verification';
  if (status === 401 || password || /\/(?:login|signin|sign-in|authwall|checkpoint)(?:[/?#]|$)/i.test(new URL(url).pathname) || /(?:sign in|log in|create an account) to (?:continue|view|see|access)/i.test(visible)) return 'authentication';
  if (status === 403) return 'blocked';
  if (status >= 400) return 'http-error';
  if (!text.trim()) return 'unreadable';
  return 'needs-review';
}

export async function collectBatch(input, chromium) {
  const pages = validateBatch(input);
  const groups = new Map();
  for (const item of pages) {
    const origin = new URL(item.url).origin;
    if (!groups.has(origin)) groups.set(origin, []);
    groups.get(origin).push(item);
  }
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const queues = [...groups.values()];
  let cursor = 0;
  try {
    // One active page per origin; up to three independent sources. A wall stops that source.
    await Promise.all(Array.from({ length: Math.min(3, queues.length) }, async () => {
      while (cursor < queues.length) {
        const queue = queues[cursor++];
        let stopped;
        const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block' });
        try {
          await context.route('**/*', route => ['image', 'media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue());
          for (const item of queue) {
            if (stopped) { results.push({ ...item, status: 'skipped-access', reason: stopped }); continue; }
            const page = await context.newPage();
            page.setDefaultTimeout(5000);
            page.on('dialog', dialog => void dialog.dismiss());
            try {
              const response = await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
              // Read a wall before waiting for result selectors which cannot appear behind it.
              const read = async () => {
                const text = (await page.locator('body').innerText()).slice(0, 200001);
                return { status: response?.status() ?? 0, url: page.url(), title: await page.title(), text, password: await page.locator('input[type=password]:visible').count() > 0 };
              };
              let snapshot = await read();
              let status = accessStatus(snapshot);
              if (status === 'needs-review' && item.waitFor) {
                await page.locator(item.waitFor).first().waitFor({ state: 'visible', timeout: 10000 });
                snapshot = await read();
                status = accessStatus(snapshot);
              }
              const result = { key: item.key, requestedUrl: item.url, url: snapshot.url, capturedAt: new Date().toISOString(), method: 'headless-browser', status, httpStatus: snapshot.status, title: snapshot.title };
              if (status === 'needs-review') {
                result.text = snapshot.text.slice(0, 200000);
                result.truncated = snapshot.text.length > 200000;
                result.links = await page.locator('a[href]').evaluateAll(anchors => anchors.filter(a => a.innerText.trim() && /^https?:/.test(a.href)).slice(0, 300).map(a => ({ label: a.innerText.trim().slice(0, 300), url: a.href })));
              } else {
                // Failed pages are access metadata, never listing evidence.
                stopped = status;
              }
              results.push(result);
            } catch {
              stopped = 'navigation-or-render-failure';
              results.push({ key: item.key, requestedUrl: item.url, status: stopped });
            } finally { await page.close(); }
          }
        } finally { await context.close(); }
      }
    }));
  } finally { await browser.close(); }
  return { results: pages.map(item => results.find(result => result.key === item.key)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--help')) {
      console.log('node /opt/careervista/headless/headless.mjs --output /tmp/new-evidence.json < approved-pages.json\nInput: {pages:[{key:"prepared-work-key",url:"https://approved-source/search",waitFor:"observed result selector (optional)"}]}\nRequires review of query/location/content. No login, stealth, retries or automatic ingestion.');
    } else {
      if (args.length !== 2 || args[0] !== '--output') throw new Error('Use --output <new-file> with JSON on stdin.');
      const input = JSON.parse(readFileSync(0, 'utf8'));
      validateBatch(input);
      const { chromium } = await import('playwright');
      const result = await collectBatch(input, chromium);
      writeFileSync(resolve(args[1]), JSON.stringify(result), { flag: 'wx', mode: 0o600 });
      console.log(JSON.stringify({ output: resolve(args[1]), pages: result.results.map(({ key, url, requestedUrl, status, title, truncated, links }) => ({ key, url: url ?? requestedUrl, status, title, truncated, linkCount: links?.length })) }));
      if (!result.results.some(page => page.status === 'needs-review')) process.exitCode = 1;
    }
  } catch { console.error('Headless collection failed; check approved input, Docker browser availability and a new output path. No source success has been established.'); process.exitCode = 1; }
}
