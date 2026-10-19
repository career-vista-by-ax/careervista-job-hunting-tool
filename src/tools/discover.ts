import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Board { source: 'greenhouse' | 'lever'; board: string; company: string; region?: 'global' | 'eu' }
interface Config { boards: Board[]; keywords: string[]; locations?: string[]; limit?: number }
export interface Candidate {
  id: string; source: 'employer'; sourceUrl: string; title: string; company: string; location: string | null;
  text: string; capturedAt: string; contentHash: string; matchedTerms: string[]; locationMatch: boolean | null;
  context: { method: 'public-api'; provider: string; endpoint: string };
}
type Json = Record<string, any>;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
function plain(input: unknown): string {
  if (typeof input !== 'string') return '';
  // Keep a deterministic readable evidence snapshot; source HTML never executes.
  let decoded=input;
  for(let pass=0;pass<2;pass++)decoded=decoded.replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&amp;/gi,'&');
  return decoded.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[^]*?-->/g, '')
    .replace(/<\/(p|div|li|h[1-6])\s*>|<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, entity => {
      const named: Record<string,string> = {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};
      if (named[entity.toLowerCase()]) return named[entity.toLowerCase()]!;
      const number = entity[2]?.toLowerCase() === 'x' ? parseInt(entity.slice(3,-1),16) : parseInt(entity.slice(2,-1),10);
      return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
    }).replace(/[ \t]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim();
}
export function validateConfig(input: unknown): Config {
  const config = input as Config;
  if (!config || typeof config !== 'object' || Object.keys(config).some(key => !['boards','keywords','locations','limit'].includes(key))) throw new Error('Use boards, keywords, locations and limit only.');
  if (!Array.isArray(config.boards) || !config.boards.length || config.boards.length > 30) throw new Error('Choose 1–30 approved public employer boards.');
  for (const board of config.boards) {
    if (!board || Object.keys(board).some(key => !['source','board','company','region'].includes(key)) || !['greenhouse','lever'].includes(board.source) || typeof board.board !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(board.board) || typeof board.company !== 'string' || !board.company.trim() || board.company.length > 500 || (board.region !== undefined && !['global','eu'].includes(board.region))) throw new Error('Each board needs source greenhouse/lever, its observed board slug, and company; Lever may specify region global/eu.');
  }
  for (const key of ['keywords','locations'] as const) {
    if (key === 'locations' && config.locations === undefined) continue;
    if (!Array.isArray(config[key]) || !config[key]!.length || config[key]!.length > 100 || config[key]!.some(term => typeof term !== 'string' || !term.trim() || term.length > 200)) throw new Error(`${key} must contain 1–100 non-empty search terms.`);
  }
  if (config.limit !== undefined && (!Number.isInteger(config.limit) || config.limit < 1 || config.limit > 5000)) throw new Error('limit must be 1–5000 compact candidates.');
  return config;
}
async function request(url: string, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(url, { headers: { Accept:'application/json' }, redirect:'error', signal:AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(response.status === 429 ? 'rate-limited' : response.status === 401 || response.status === 403 ? 'access-blocked' : `http-${response.status}`);
  const reader=response.body?.getReader(); if(!reader)throw new Error('empty-response');
  const chunks:Uint8Array[]=[];let bytes=0;
  try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>20_000_000)throw new Error('response-too-large');chunks.push(part.value);}}finally{await reader.cancel();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function safeUrl(input: unknown): string {
  if(typeof input!=='string')throw new Error('missing-listing-url');
  const url=new URL(input);if(url.protocol!=='https:'||url.username||url.password)throw new Error('invalid-listing-url');url.hash='';return url.href;
}
export async function discover(input: unknown, fetcher: typeof fetch = fetch) {
  const config=validateConfig(input), keywords=config.keywords.map(term=>term.toLocaleLowerCase()), locations=config.locations?.map(term=>term.toLocaleLowerCase());
  const reports: {board:Board;status:'ok'|'partial'|'failed';fetched:number;matched:number;error?:string}[] = [];
  const candidates: Candidate[]=[];
  // Three workers bound network work independently of model calls. No retries on blocked access.
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(3,config.boards.length)},async()=>{
    while(cursor<config.boards.length){
      const board=config.boards[cursor++]!,report:{board:Board;status:'ok'|'partial'|'failed';fetched:number;matched:number;error?:string}={board,status:'ok',fetched:0,matched:0};reports.push(report);
      try{
        const endpoint=board.source==='greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${board.board}/jobs?content=true`:`https://${board.region==='eu'?'api.eu.lever.co':'api.lever.co'}/v0/postings/${board.board}?mode=json`;
        let offset=0;
        for(let page=0;page<10;page++){
          const pageUrl=board.source==='lever'?`${endpoint}&limit=100&skip=${offset}`:endpoint;
          const payload=await request(pageUrl,fetcher), jobs=board.source==='greenhouse'?(payload as Json)?.jobs:payload;
          if(!Array.isArray(jobs)||jobs.length>10000)throw new Error('invalid-job-list');
          report.fetched+=jobs.length;
          for(const job of jobs as Json[]){
            if(!job||typeof job!=='object')throw new Error('invalid-job');
            const title=board.source==='greenhouse'?job.title:job.text;
            if(typeof title!=='string'||!title.trim())throw new Error('missing-title');
            const location=board.source==='greenhouse'?plain(job.location?.name):[...new Set([job.categories?.location,...(Array.isArray(job.categories?.allLocations)?job.categories.allLocations:[])].filter(value=>typeof value==='string'))].join('; ');
            const description=board.source==='greenhouse'?plain(job.content):[
              job.descriptionPlain??plain(job.description),
              ...(Array.isArray(job.lists)?job.lists.flatMap((list:Json)=>[plain(list.text),plain(list.content)]):[]),
              job.additionalPlain??plain(job.additional),
              job.salaryDescriptionPlain??plain(job.salaryDescription),
            ].filter(value=>typeof value==='string'&&value.trim()).join('\n\n');
            if(!description) { report.status='partial';report.error='missing-description';continue; }
            const text=[title,location,board.source==='lever'?job.categories?.commitment:null,board.source==='lever'?job.workplaceType:null,description,board.source==='lever'&&job.salaryRange?JSON.stringify(job.salaryRange):null].filter(value=>typeof value==='string'&&value.trim()).join('\n\n');
            if(text.length>1_000_000)throw new Error('listing-too-large');
            const searchText=`${title}\n${description}`.toLocaleLowerCase(), matchedTerms=config.keywords.filter((_,index)=>searchText.includes(keywords[index]!));
            if(!matchedTerms.length)continue;
            const sourceUrl=safeUrl(board.source==='greenhouse'?job.absolute_url:job.hostedUrl);
            report.matched++;
            candidates.push({id:hash(sourceUrl).slice(0,24),source:'employer',sourceUrl,title,company:board.company,location:location||null,text,capturedAt:new Date().toISOString(),contentHash:hash(text),matchedTerms,locationMatch:!location||!locations?null:locations.some(term=>location.toLocaleLowerCase().includes(term)),context:{method:'public-api',provider:board.source,endpoint:pageUrl}});
          }
          if(board.source==='greenhouse'||jobs.length<100)break;
          offset+=jobs.length;
          if(page===9){report.status='partial';report.error='page-limit';}
        }
      }catch(error){report.status=report.fetched?'partial':'failed';const code=error instanceof Error?error.message:'';report.error=/^(rate-limited|access-blocked|http-\d+|invalid-job-list|invalid-job|missing-title|empty-response|response-too-large|missing-listing-url|invalid-listing-url|listing-too-large)$/.test(code)?code:'request-or-format-failure';}
    }
  }));
  const unique=[...new Map(candidates.map(item=>[item.sourceUrl,item])).values()];
  unique.sort((a,b)=>Number(b.locationMatch===true)-Number(a.locationMatch===true)||b.matchedTerms.length-a.matchedTerms.length||a.sourceUrl.localeCompare(b.sourceUrl));
  const limit=config.limit??200;
  return {candidates:unique.slice(0,limit),reports:reports.sort((a,b)=>a.board.board.localeCompare(b.board.board)),counts:{fetched:reports.reduce((sum,report)=>sum+report.fetched,0),matched:unique.length,retained:Math.min(unique.length,limit),truncated:unique.length>limit}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2);
    if(args.includes('--help')){console.log('node dist/tools/discover.js --config <approved-boards.json> --output <evidence.json>\nConfig: {boards:[{source:"greenhouse"|"lever",board:"observed-slug",company:"Employer"}],keywords:["approved terms"],locations:["Melbourne","Australia"],limit:200}\nWrites evidence locally; stdout contains counts and previews. No credentials or model required.');}
    else{
      if(args.length!==4||args[0]!=='--config'||args[2]!=='--output')throw new Error('Use --config <file> --output <new evidence file>, or --help.');
      const result=await discover(JSON.parse(readFileSync(resolve(args[1]!), 'utf8')));
      writeFileSync(resolve(args[3]!),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
      console.log(JSON.stringify({output:resolve(args[3]!),counts:result.counts,reports:result.reports,previewLimit:20,previews:result.candidates.slice(0,20).map(({id,title,company,location,sourceUrl,matchedTerms,locationMatch})=>({id,title,company,location,url:sourceUrl,matchedTerms,locationMatch}))}));
      if(result.reports.every(report=>report.status==='failed'))process.exitCode=1;
    }
  }catch{console.error('Discovery failed. Check config, network access and output path; use --help.');process.exitCode=1;}
}
