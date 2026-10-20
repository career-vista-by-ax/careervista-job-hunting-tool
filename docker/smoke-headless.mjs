import assert from 'node:assert/strict';
import { chromium } from '/opt/careervista/headless/node_modules/playwright/index.mjs';
import { collectBatch } from '/opt/careervista/headless/headless.mjs';

// Exercise the real container Chromium with deterministic pages, including delayed rendering.
const requests=[];
const fixtures={
  '/first':'<title>Jobs</title><body><div id="query">Analytics Engineer · Melbourne</div><script>setTimeout(()=>{document.body.insertAdjacentHTML("beforeend",\'<article><a href="/job/123">Staff Analytics Engineer</a></article>\')},150)</script></body>',
  '/wall':'<title>Just a moment</title><body>Verify you are human</body>',
  '/later':'<body>This request must never run</body>',
  '/login':'<title>Reviews</title><body>Sign in to view reviews<input type="password"></body>',
  '/mismatch':'<title>Jobs</title><body>Sydney Chef — wrong query and location</body>',
};
const instrumented={launch:async options=>{
  const browser=await chromium.launch(options);
  const newContext=browser.newContext.bind(browser);
  browser.newContext=async options=>{
    const context=await newContext(options);
    const newPage=context.newPage.bind(context);
    context.newPage=async()=>{
      const page=await newPage();
      await page.route('https://*.example.test/**',route=>{
        const url=new URL(route.request().url());requests.push(url.href);
        return route.fulfill({contentType:'text/html',body:fixtures[url.pathname]??'<body>Unknown</body>'});
      });
      return page;
    };
    return context;
  };
  return browser;
}};
const result=await collectBatch({pages:[
  {key:'first',url:'https://jobs.example.test/first',waitFor:'article'},
  {key:'wall',url:'https://jobs.example.test/wall'},
  {key:'later',url:'https://jobs.example.test/later'},
  {key:'login',url:'https://reviews.example.test/login'},
  {key:'mismatch',url:'https://other.example.test/mismatch'},
]},instrumented);
assert.deepEqual(result.results.map(page=>page.status),['needs-review','verification','skipped-access','authentication','needs-review']);
assert.match(result.results[0].text,/Staff Analytics Engineer/);
assert.equal(result.results[0].links[0].url,'https://jobs.example.test/job/123');
assert.equal(result.results[1].text,undefined);
assert.equal(result.results[3].text,undefined);
assert.ok(!requests.some(url=>url.endsWith('/later')));
assert.match(result.results[4].text,/wrong query/); // Readable mismatches still require agent review.
console.log('PASS: real headless Chromium; delayed results, wall circuit breaker, login and unverified mismatches.');
