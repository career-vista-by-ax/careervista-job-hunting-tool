import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { AppError, CareerVistaApp } from './app.ts';
import type { ObservationInput } from './app.ts';

export interface RouteContext {
  app: CareerVistaApp; request: IncomingMessage; response: ServerResponse;
  url: URL; json: (maxBytes?: number) => Promise<unknown>; send: (value: unknown, status?: number) => void;
}
/** Return true when handled. Install module routes via startServer({ routes: [...] }). */
export type ApiRoute = (context: RouteContext) => boolean | Promise<boolean>;

async function readJson(request: IncomingMessage, maxBytes = 2_000_000): Promise<unknown> {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new AppError('Use Content-Type: application/json.', 415, 'unsupported_media_type');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new AppError(`Request exceeds the ${maxBytes} byte limit.`, 413, 'payload_too_large');
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AppError('Request must contain valid JSON.'); }
}
const assets: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/client.js': ['client.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
};
export async function startServer(app: CareerVistaApp, options: { port?: number; routes?: ApiRoute[]; host?: '127.0.0.1' | '0.0.0.0'; publicOrigin?: string } = {}) {
  let origin = '';
  const host=options.host??'127.0.0.1';
  if(host!=='127.0.0.1'&&host!=='0.0.0.0')throw new AppError('Unsupported listener address.');
  let publicOrigin:string|undefined;
  if(options.publicOrigin){const value=new URL(options.publicOrigin);if(value.protocol!=='http:'||value.hostname!=='127.0.0.1'||value.username||value.password||value.pathname!=='/'||value.search||value.hash)throw new AppError('Public origin must be an exact HTTP loopback origin.');publicOrigin=value.origin;}
  if(host==='0.0.0.0'&&!publicOrigin)throw new AppError('A container listener requires an explicit public loopback origin.');
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    response.setHeader('Referrer-Policy', 'no-referrer');
    const send = (value: unknown, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(value));
    };
    try {
      if (request.headers.host !== new URL(origin).host) throw new AppError('Only the local application host is allowed.', 403, 'forbidden_host');
      if (request.headers.origin && request.headers.origin !== origin) throw new AppError('Requests must originate from the local application.', 403, 'forbidden_origin');
      const isDocumentNavigation = request.method === 'GET' && request.url === '/' && request.headers['sec-fetch-mode'] === 'navigate' && request.headers['sec-fetch-dest'] === 'document';
      if (request.headers['sec-fetch-site'] === 'cross-site' && !isDocumentNavigation) throw new AppError('Cross-site requests are not allowed.', 403, 'forbidden_origin');
      const url = new URL(request.url ?? '/', origin);
      const context: RouteContext = { app, request, response, url, json: maxBytes => readJson(request, maxBytes), send };
      const agentGuides = ['ax-30-secs', 'capture-interface', 'seek', 'linkedin', 'language', 'history', 'agent-workflow', 'agent-intake', 'ax-cv', 'profiles', 'resume', 'runs', 'collection', 'assessments', 'compensation', 'feedback', 'reassessment', 'sparse-results', 'applications', 'availability', 'company', 'custom-sources', 'reconciliation'] as const;
      if (request.method === 'GET' && url.pathname === '/api/v1/agent-guide') {
        send({ workflow: '/api/v1/agent-guide/agent-workflow', guides: agentGuides.map(name => ({ name, path: `/api/v1/agent-guide/${name}` })) }); return;
      }
      const guideName = url.pathname.slice('/api/v1/agent-guide/'.length);
      if (request.method === 'GET' && url.pathname.startsWith('/api/v1/agent-guide/')) {
        if (!agentGuides.some(name => name === guideName)) throw new AppError('Agent guide not found.', 404, 'not_found');
        const captureFile=guideName==='capture-interface'?'interface':guideName==='seek'?'seek':guideName==='linkedin'?'linkedin':null;
        const paths = captureFile
          ? [new URL(`../agent-skills/v1/careervista-capture/${captureFile}.md`,import.meta.url),new URL(`../../agent-skills/v1/careervista-capture/${captureFile}.md`,import.meta.url)]
          : ['ax-cv','ax-30-secs'].includes(guideName)
          ? [new URL(`../agent-skills/v1/${guideName}/SKILL.md`, import.meta.url), new URL(`../../agent-skills/v1/${guideName}/SKILL.md`, import.meta.url)]
          : [new URL(`../docs/${guideName}.md`, import.meta.url)];
        const path = paths.find(candidate => existsSync(candidate));
        if (!path) throw new AppError('This agent guide is missing from the installation.', 503, 'guide_unavailable');
        send({ name: guideName, markdown: readFileSync(path, 'utf8') }); return;
      }
      for (const route of options.routes ?? []) if (await route(context)) return;
      if (request.method === 'GET' && url.pathname === '/api/v1/jobs') { send(app.listJobs()); return; }
      if (request.method === 'GET' && /^\/api\/v1\/jobs\/[^/]+$/.test(url.pathname)) { send(app.getJob(decodeURIComponent(url.pathname.split('/').at(-1)!))); return; }
      if (request.method === 'POST' && url.pathname === '/api/v1/observations') {
        const result = app.saveObservation(await context.json() as ObservationInput);
        send(result, result.replayed ? 200 : 201); return;
      }
      // Serve only filename-only compiled browser modules inside public/.
      const moduleName = /^\/[a-zA-Z0-9_-]+\.js$/.test(url.pathname) ? url.pathname.slice(1) : undefined;
      if (request.method === 'GET' && moduleName && !assets[url.pathname]) {
        let content: Buffer;
        try { content = readFileSync(new URL(`./public/${moduleName}`, import.meta.url)); }
        catch { throw new AppError('Browser module not found. Build the application first.', 404, 'not_found'); }
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); response.end(content); return;
      }
      if (request.method === 'GET' && assets[url.pathname]) {
        const [name, type] = assets[url.pathname]!;
        // Source execution is for development/tests; production contains compiled client.js.
        let content: Buffer;
        try { content = readFileSync(new URL(`./public/${name}`, import.meta.url)); }
        catch (error) {
          if (name !== 'client.js') throw error;
          content = Buffer.from('/* Build the application with npm run build to enable the UI. */');
        }
        response.writeHead(200, { 'Content-Type': type }); response.end(content); return;
      }
      throw new AppError('This route does not exist. Use the documented /api/v1 interface.', 404, 'not_found');
    } catch (error) {
      if (error instanceof AppError) send({ error: { code: error.code, message: error.message } }, error.status);
      else send({ error: { code: 'internal_error', message: 'The operation failed. Saved records have been retained; retry or restart the app.' } }, 500);
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 4318, host, () => { server.off('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not bind a local port.');
  origin = publicOrigin ?? `http://127.0.0.1:${address.port}`;
  return { url: origin, server, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
