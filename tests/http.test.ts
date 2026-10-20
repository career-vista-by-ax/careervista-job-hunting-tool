import { request } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerVistaApp } from '../src/app.ts';
import { startServer } from '../src/server.ts';

test('localhost UI and versioned API save evidence and reject cross-origin or rebound requests', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-http-'));
  const app = new CareerVistaApp({ root });
  const server = await startServer(app, { port: 0 });
  try {
    const page = await fetch(server.url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /CareerVista/);
    const body = JSON.stringify({ ingestionId: 'api-1', source: 'manual', sourceUrl: 'https://example.com/1', capturedAt: '2026-10-18T01:00:00Z', text: 'Teach primary school students.', title: 'Primary School Teacher', company: 'Example' });
    const saved = await fetch(`${server.url}/api/v1/observations`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: server.url }, body });
    assert.equal(saved.status, 201);
    const result = await saved.json() as { job: { id: string } };
    const detail = await fetch(`${server.url}/api/v1/jobs/${result.job.id}`);
    assert.equal((await detail.json() as { observations: { text: string }[] }).observations[0]?.text, 'Teach primary school students.');
    const hostile = await fetch(`${server.url}/api/v1/observations`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body });
    assert.equal(hostile.status, 403);
    const reboundStatus = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(`${server.url}/api/v1/jobs`, { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(reboundStatus, 403);
    const malformed = await fetch(`${server.url}/api/v1/observations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    assert.match((await malformed.json() as { error: { message: string } }).error.message, /JSON/);
  } finally { await server.close(); app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('opening the app from another page allows only document navigation, not cross-site data access', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-navigation-'));
  const app = new CareerVistaApp({ root });
  const server = await startServer(app, { port: 0 });
  const status = (path: string, headers: Record<string, string>) => new Promise<number | undefined>((resolve, reject) => {
    const req = request(`${server.url}${path}`, { headers }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  try {
    const navigation = { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' };
    assert.equal(await status('/', navigation), 200);
    assert.equal(await status('/api/v1/jobs', navigation), 403);
    assert.equal(await status('/', { 'Sec-Fetch-Site': 'cross-site' }), 403);
  } finally { await server.close(); app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('container port mapping keeps the explicit loopback Host and Origin boundary and portable guides', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cv-container-http-'));
  const app = new CareerVistaApp({ root });
  try {
    await assert.rejects(startServer(app, {port:0,host:'0.0.0.0'}), /explicit public loopback origin/);
    await assert.rejects(startServer(app, {port:0,host:'0.0.0.0',publicOrigin:'http://evil.example:4318'}), /exact HTTP loopback origin/);
    const server = await startServer(app, {port:0,host:'0.0.0.0',publicOrigin:'http://127.0.0.1:64818'});
    const address=server.server.address();
    assert.ok(address&&typeof address!=='string');
    const get=(path:string,headers:Record<string,string>)=>new Promise<{status:number|undefined;body:string}>((resolve,reject)=>{
      const req=request(`http://127.0.0.1:${address.port}${path}`,{headers},res=>{
        let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body}));
      });req.on('error',reject);req.end();
    });
    try {
      assert.equal(server.url,'http://127.0.0.1:64818');
      assert.equal((await get('/api/v1/jobs',{Host:`127.0.0.1:${address.port}`})).status,403);
      assert.equal((await get('/api/v1/jobs',{Host:'127.0.0.1:64818',Origin:'http://evil.example'})).status,403);
      assert.equal((await get('/api/v1/jobs',{Host:'127.0.0.1:64818',Origin:server.url})).status,200);
      for(const name of ['capture-interface','seek','linkedin','ax-cv','ax-30-secs']){
        const response=await get(`/api/v1/agent-guide/${name}`,{Host:'127.0.0.1:64818'});
        assert.equal(response.status,200,name);
        assert.ok(JSON.parse(response.body).markdown.length>100,name);
      }
    } finally {await server.close();}
  } finally {app.close();rmSync(root,{recursive:true,force:true});}
});
