import { test } from 'node:test';
import assert from 'node:assert/strict';
// Docker-only runtime dependency is loaded lazily, so these checks need no local Playwright.
// @ts-ignore JavaScript helper is shipped separately from the native app.
import { validateBatch, accessStatus } from '../docker/headless.mjs';

test('headless batch accepts prepared public pages and rejects invalid work before launching Chromium', () => {
  assert.deepEqual(validateBatch({pages:[{key:'query-1',url:'https://www.seek.com.au/jobs',waitFor:'article'}]}),[{key:'query-1',url:'https://www.seek.com.au/jobs',waitFor:'article'}]);
  for (const pages of [[], Array.from({length:101},(_,i)=>({key:`q-${i}`,url:'https://example.org'})), [{key:'q',url:'file:///tmp/private'}], [{key:'q',url:'https://name:password@example.org'}], [{key:'q',url:'https://example.org'},{key:'q',url:'https://example.org'}]]) assert.throws(()=>validateBatch({pages}));
});

test('200 challenge/login pages, rate limits and blank content never become search success', () => {
  const page={status:200,url:'https://example.org/jobs',title:'Jobs',text:'Analytics Engineer Melbourne',password:false};
  assert.equal(accessStatus(page),'needs-review');
  assert.equal(accessStatus({...page,text:'Verify you are human'}),'verification');
  assert.equal(accessStatus({...page,title:'Just a moment...'}),'verification');
  assert.equal(accessStatus({...page,text:'Sign in to view these reviews'}),'authentication');
  assert.equal(accessStatus({...page,password:true}),'authentication');
  assert.equal(accessStatus({...page,url:'https://example.org/authwall'}),'authentication');
  assert.equal(accessStatus({...page,status:429}),'rate-limited');
  assert.equal(accessStatus({...page,status:403}),'blocked');
  assert.equal(accessStatus({...page,text:''}),'unreadable');
});
