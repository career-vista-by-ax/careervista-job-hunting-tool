import {DatabaseSync,backup} from 'node:sqlite';
import {isDeepStrictEqual} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,realpathSync,renameSync,rmSync,writeFileSync,copyFileSync,chmodSync,statSync,rmdirSync,unlinkSync,constants} from 'node:fs';
import {homedir,tmpdir,platform} from 'node:os';
import {dirname,join,resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawn} from 'node:child_process';
import {AppError} from './app.ts';
import type {ApiRoute} from './server.ts';
interface Release {format:'careervista-release';version:string;nodeVersion:string;runtime:string;entry:string;files:Record<string,string>}
interface Manifest {format:'careervista-installation';version:1;id:string;root:string;active:string|null;releases:Record<string,Release>;registrations:{host:'codex'|'agents';files:Record<string,string>}[]}
interface Running {installationId:string;instanceId:string;nonce:string;url:string;pid:number}
const persistent=['data','credentials','sessions'];const disposable=['cache','logs','temp'];
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const fail=(message:string):never=>{throw new AppError(message,409,'lifecycle_conflict');};
const safeRelative=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&!isAbsolute(value)&&!value.includes('\\')&&value.split('/').every(part=>part!==''&&part!=='.'&&part!=='..'&&!part.includes(':')&&!part.includes('\0'));
function plain(path:string,directory?:boolean){if(!existsSync(path))return;const stat=lstatSync(path);if(stat.isSymbolicLink()||(directory===true&&!stat.isDirectory())||(directory===false&&!stat.isFile()))fail(`Unsafe symlink or unexpected file type: ${path}`);}
function treeNoLinks(path:string){plain(path,true);for(const name of readdirSync(path)){const child=join(path,name);plain(child);if(lstatSync(child).isDirectory())treeNoLinks(child);}}
function within(base:string,path:string){if(!safeRelative(path))fail('Invalid owned artifact path.');let current=base;plain(current,true);for(const part of path.split('/')){current=join(current,part);plain(current);}return current;}
function atomic(path:string,value:unknown){const temporary=`${path}.${randomUUID()}.tmp`;try{writeFileSync(temporary,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});renameSync(temporary,path);}finally{rmSync(temporary,{force:true});}}
export function defaultRoot(){return platform()==='darwin'?join(homedir(),'Library','Application Support','CareerVista'):platform()==='win32'?join(process.env.LOCALAPPDATA??join(homedir(),'AppData','Local'),'CareerVista'):join(process.env.XDG_DATA_HOME??join(homedir(),'.local','share'),'careervista');}
function release(value:unknown):Release{const item=value as Release;if(!item||item.format!=='careervista-release'||typeof item.version!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(item.version)||item.version.includes('..')||item.nodeVersion!=='26.12.0'||!item.files||typeof item.files!=='object'||Array.isArray(item.files))fail('Unsupported release manifest or runtime version.');if(!safeRelative(item.runtime)||!['runtime/node','runtime/node.exe'].includes(item.runtime)||item.entry!=='app/dist/main.js')fail('Unsupported runtime/entry paths.');for(const [path,digest]of Object.entries(item.files)){if(!safeRelative(path)||!['app','runtime','licenses','agent-skills'].includes(path.split('/')[0]!)||typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest))fail('Invalid release artifact path or checksum.');}for(const required of [item.runtime,item.entry,'runtime/LICENSE','app/dist/lifecycle.js'])if(!item.files[required])fail(`Release is missing ${required}.`);return item;}
export class Installation {
 readonly root:string;
 constructor(input:string=defaultRoot()) {const path=resolve(input);if(path===sep||path===resolve(homedir())||dirname(path)===path)fail('Installation root cannot be filesystem or home root.');plain(path,true);mkdirSync(dirname(path),{recursive:true});this.root=join(realpathSync(dirname(path)),path.split(sep).at(-1)!);}
 private manifest(optional=false):Manifest|null{plain(this.root,true);const path=within(this.root,'state/installation.json');if(!existsSync(path)){if(optional)return null;return fail('Installation ownership manifest not found.');}let item:Manifest;try{item=JSON.parse(readFileSync(path,'utf8'));}catch{return fail('Invalid installation ownership manifest.');}if(item.format!=='careervista-installation'||item.version!==1||item.root!==this.root||typeof item.id!=='string'||!/^[a-f0-9-]{36}$/.test(item.id)||!item.releases||typeof item.releases!=='object'||Array.isArray(item.releases)||!Array.isArray(item.registrations))fail('Invalid installation ownership or canonical root.');for(const[key,value]of Object.entries(item.releases)){const known=release(value);if(key!==known.version)fail('Release ownership version mismatch.');}if(item.active!==null&&!item.releases[item.active])fail('Active release is not owned.');for(const registration of item.registrations)if(!['codex','agents'].includes(registration.host)||!registration.files||Object.entries(registration.files).some(([path,digest])=>!safeRelative(path)||typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest)))fail('Invalid external registration ownership.');for(const name of [...persistent,...disposable,'state','releases'])plain(join(this.root,name),true);return item;}
 private async locked<T>(operation:()=>Promise<T>):Promise<T>{mkdirSync(this.root,{recursive:true,mode:0o700});plain(this.root,true);plain(join(this.root,'state'),true);mkdirSync(join(this.root,'state'),{recursive:true,mode:0o700});const path=join(this.root,'state','lifecycle.lock');plain(path,false);const token=randomUUID();try{writeFileSync(path,JSON.stringify({token,pid:process.pid}),{flag:'wx',mode:0o600});}catch{fail('Installation is busy or has a stale lifecycle lock. Inspect state/lifecycle.lock before retrying; no process was killed.');}try{await this.recoverUpgrade();return await operation();}finally{if(existsSync(path)&&JSON.parse(readFileSync(path,'utf8')).token===token)unlinkSync(path);}}
 status(){const manifest=this.manifest(true);return{root:this.root,installed:Boolean(manifest?.active),installationId:manifest?.id??null,active:manifest?.active??null,retained:persistent.filter(name=>existsSync(join(this.root,name)))};}
 async install(bundle:string){return this.locked(async()=>{
  let current=this.manifest(true);
  if(!current){
   const unknown=readdirSync(this.root).filter(name=>name!=='state');
   const stateUnknown=readdirSync(join(this.root,'state')).filter(name=>name!=='lifecycle.lock');
   if(unknown.length||stateUnknown.length)fail('Refusing an unrelated populated installation root. Choose an empty directory.');
   current={format:'careervista-installation',version:1,id:randomUUID(),root:this.root,active:null,releases:{},registrations:[]};
   atomic(join(this.root,'state','installation.json'),current);
  }
  const base=resolve(bundle);plain(base,true);plain(join(base,'release.json'),false);
  const incoming=release(JSON.parse(readFileSync(join(base,'release.json'),'utf8')));
  let bytes=0;
  for(const[path,digest]of Object.entries(incoming.files)){
   const file=within(base,path);plain(file,false);
   if(!existsSync(file)||hash(file)!==digest)fail(`Release checksum mismatch: ${path}`);
   bytes+=statSync(file).size;
  }
  if(bytes>512*1024*1024)fail('Release exceeds the 512 MiB installation cap.');
  const version=execFileSync(within(base,incoming.runtime),['--version'],{encoding:'utf8',timeout:10000}).trim();
  if(version!==`v${incoming.nodeVersion}`)fail('Bundled runtime version does not match release metadata.');
  await this.stopOwned(current);
  const releases=within(this.root,'releases');mkdirSync(releases,{recursive:true,mode:0o700});
  const journalPath=within(this.root,'state/install-stage.json');
  if(existsSync(journalPath)){
   const journal=JSON.parse(readFileSync(journalPath,'utf8'));
   if(journal.installationId!==current.id||typeof journal.stage!=='string'||!/^\.stage-[a-f0-9-]{36}$/.test(journal.stage))fail('Untrusted interrupted-install journal; inspect before retry.');
   const orphan=within(this.root,`releases/${journal.stage}`);
   if(existsSync(orphan)){treeNoLinks(orphan);rmSync(orphan,{recursive:true});}
   unlinkSync(journalPath);
  }
  const priorActive=current.active,target=within(this.root,`releases/${incoming.version}`);
  if(existsSync(target)){
   const previous=current.releases[incoming.version];
   if(!previous||!isDeepStrictEqual(previous,incoming)||Object.entries(incoming.files).some(([path,digest])=>!existsSync(within(target,path))||hash(within(target,path))!==digest))fail('An existing release differs from this package. Use a distinct version; preserved existing files.');
  }
  const stageName=`.stage-${randomUUID()}`,stage=join(releases,stageName);
  try{
   const upgrade=await this.prepareUpgrade(current,incoming,base);
   if(!existsSync(target)){
    atomic(journalPath,{installationId:current.id,stage:stageName});mkdirSync(stage,{mode:0o700});
    for(const[path,digest]of Object.entries(incoming.files)){
     const source=within(base,path),destination=join(stage,path);mkdirSync(dirname(destination),{recursive:true});
     copyFileSync(source,destination);chmodSync(destination,statSync(source).mode&0o777);
     if(hash(destination)!==digest)fail(`Staged release checksum mismatch: ${path}`);
    }
    current.releases[incoming.version]=incoming;
    atomic(join(this.root,'state','installation.json'),current);
    renameSync(stage,target);
   }
   if(upgrade)await this.runMigration(target,incoming,this.root);
   current.active=incoming.version;
   atomic(join(this.root,'state','installation.json'),current);
   await this.recoverUpgrade();
   for(const name of [...persistent,...disposable])mkdirSync(join(this.root,name),{recursive:true,mode:0o700});
   const preserved:string[]=[];
   for(const [oldVersion,oldRelease]of Object.entries(current.releases)){
    if(oldVersion===incoming.version||oldVersion===priorActive)continue;
    const oldRoot=within(this.root,`releases/${oldVersion}`);
    if(existsSync(oldRoot))preserved.push(...this.removeFiles(oldRoot,oldRelease.files));
    if(!existsSync(oldRoot))delete current.releases[oldVersion];
   }
   atomic(join(this.root,'state','installation.json'),current);
   return{...this.status(),upgraded:upgrade,preservedModifiedFiles:preserved};
  }catch(error){await this.recoverUpgrade();throw error;}
  finally{if(existsSync(stage)){treeNoLinks(stage);rmSync(stage,{recursive:true});}rmSync(journalPath,{force:true});}
 });}
 private async runMigration(base:string,incoming:Release,root:string){
  if(!incoming.files['app/dist/migrate.js'])fail('This release has no verified database migration helper.');
  const token=randomUUID();
  const child=spawn(within(base,incoming.runtime),[within(base,'app/dist/migrate.js'),'--root',root,'--start-token',token],{stdio:['pipe','pipe','pipe']});
  if(root===this.root){
   const path=within(this.root,'state/upgrade-stage.json');
   const journal=JSON.parse(readFileSync(path,'utf8'));journal.migrationPid=child.pid;
   atomic(path,journal);
  }
  await new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>{child.kill('SIGTERM');},30000);
   child.once('error',error=>{clearTimeout(timer);reject(error);});
   child.stdout.resume();child.stderr.resume();
   child.once('close',code=>{clearTimeout(timer);if(code===0)resolve();else reject(new AppError('Database migration validation failed; the previous release and saved data are retained. Downgrades or changed applied migrations are not supported.',409,'migration_failed'));});
   // The helper cannot open the database until its PID is durably journalled.
   child.stdin.on('error',()=>{});child.stdin.end(token+'\n');
  });
 }
 private async prepareUpgrade(current:Manifest,incoming:Release,base:string){
  const databasePath=within(this.root,'data/careervista.sqlite');
  if(!existsSync(databasePath)||current.active===incoming.version)return false;
  plain(databasePath,false);
  if(!incoming.files['app/dist/migrate.js'])fail('This release has no verified database migration helper.');
  const database=new DatabaseSync(databasePath,{readOnly:true});
  const token=randomUUID(),snapshot=`state/.upgrade-${token}.sqlite`,probe=`temp/.upgrade-${token}`;
  const journal={installationId:current.id,targetVersion:incoming.version,snapshot,probe,phase:'preparing' as 'preparing'|'ready',sha256:''};
  atomic(join(this.root,'state/upgrade-stage.json'),journal);
  try{
   if(database.prepare('PRAGMA integrity_check').all().some(row=>row.integrity_check!=='ok'))fail('Saved database integrity check failed before upgrade.');
   const applied=database.prepare('SELECT name FROM migrations').all();
   for(const row of applied){const path=`app/dist/migrations/${row.name}`;
    if(!incoming.files[path]||(current.active&&current.releases[current.active]?.files[path]&&current.releases[current.active]!.files[path]!==incoming.files[path]))fail('A previously applied migration is missing or changed. Downgrade/rewritten migrations are refused.');
   }
   await backup(database,within(this.root,snapshot));
  }finally{database.close();}
  const probeRoot=within(this.root,probe);mkdirSync(join(probeRoot,'data'),{recursive:true,mode:0o700});
  copyFileSync(within(this.root,snapshot),join(probeRoot,'data/careervista.sqlite'));
  await this.runMigration(base,incoming,probeRoot);
  journal.sha256=hash(within(this.root,snapshot));journal.phase='ready';
  atomic(join(this.root,'state/upgrade-stage.json'),journal);
  return true;
 }
 private async recoverUpgrade(){
  const journalPath=within(this.root,'state/upgrade-stage.json');if(!existsSync(journalPath))return;
  plain(journalPath,false);const journal=JSON.parse(readFileSync(journalPath,'utf8'));
  const manifest=this.manifest()!;
  if(journal.installationId!==manifest.id||typeof journal.targetVersion!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(journal.targetVersion)||!/^state\/\.upgrade-[a-f0-9-]{36}\.sqlite$/.test(journal.snapshot)||!/^temp\/\.upgrade-[a-f0-9-]{36}$/.test(journal.probe)||!['preparing','ready'].includes(journal.phase))fail('Untrusted database upgrade journal; inspect before retry.');
  const snapshot=within(this.root,journal.snapshot),probe=within(this.root,journal.probe);
  if(journal.phase==='ready'&&manifest.active!==journal.targetVersion){
   if(!existsSync(snapshot)||hash(snapshot)!==journal.sha256)fail('Pre-upgrade snapshot is missing or modified. Refusing unsafe recovery.');
   if(journal.migrationPid!==undefined){if(!Number.isSafeInteger(journal.migrationPid)||journal.migrationPid<1)fail('Invalid migration process guard.');let alive=false;try{process.kill(journal.migrationPid,0);alive=true;}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')alive=true;}if(alive)fail('An interrupted migration helper may still be running. Wait for it to exit before retrying; no stored PID was signalled.');}
   await this.stopOwned(manifest);
   const databasePath=within(this.root,'data/careervista.sqlite');
   // The owned app and migration subprocess have stopped. Stale sidecars belong
   // to this closed database, never to a live user/other-project database.
   for(const suffix of ['-wal','-shm']){const sidecar=within(this.root,`data/careervista.sqlite${suffix}`);plain(sidecar,false);rmSync(sidecar,{force:true});}
   const restored=within(this.root,`data/.restore-${randomUUID()}.sqlite`);
   try{copyFileSync(snapshot,restored,constants.COPYFILE_EXCL);renameSync(restored,databasePath);}finally{rmSync(restored,{force:true});}
  }
  if(existsSync(probe)){treeNoLinks(probe);rmSync(probe,{recursive:true});}
  if(existsSync(snapshot)){plain(snapshot,false);unlinkSync(snapshot);}
  unlinkSync(journalPath);
 }
 private running(manifest:Manifest):Running|null{const path=within(this.root,'state/process.json');if(!existsSync(path))return null;let item:Running;try{item=JSON.parse(readFileSync(path,'utf8'));}catch{return fail('Ambiguous process state; refusing to stop an unidentified process.');}if(item.installationId!==manifest.id||typeof item.instanceId!=='string'||typeof item.nonce!=='string'||!/^[a-f0-9-]{36}$/.test(item.instanceId)||!/^[a-f0-9]{64}$/.test(item.nonce))fail('Process identity does not match installation ownership.');let url:URL;try{url=new URL(item.url);}catch{return fail('Invalid owned process URL.');}if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/'||url.username||url.password||url.search||url.hash)fail('Owned process control URL must be exact loopback origin.');return item;}
 private async authenticate(item:Running){const response=await fetch(`${item.url}/api/v1/control/status`,{headers:{Authorization:`Bearer ${item.nonce}`},signal:AbortSignal.timeout(1500)});const status=await response.json() as {installationId:string;instanceId:string};if(!response.ok||status.installationId!==item.installationId||status.instanceId!==item.instanceId)fail('Running process ownership could not be authenticated. No process was killed.');}
 private async stopOwned(manifest:Manifest){const running=this.running(manifest);if(!running)return{stopped:false};try{await this.authenticate(running);}catch(error){if(error instanceof TypeError&&String(error.cause).includes('ECONNREFUSED')){unlinkSync(join(this.root,'state','process.json'));return{stopped:false,staleStateRemoved:true};}return fail('Unable to authenticate the saved process. Refusing destructive operation; no PID was killed.');}const response=await fetch(`${running.url}/api/v1/control/shutdown`,{method:'POST',headers:{Authorization:`Bearer ${running.nonce}`,'Content-Type':'application/json'},body:JSON.stringify({installationId:running.installationId,instanceId:running.instanceId}),signal:AbortSignal.timeout(1500)});if(!response.ok)fail('Owned app declined shutdown.');for(let attempt=0;attempt<40;attempt++){await new Promise(resolve=>setTimeout(resolve,100));try{await this.authenticate(running);}catch(error){if(error instanceof TypeError&&String(error.cause).includes('ECONNREFUSED')){rmSync(join(this.root,'state','process.json'),{force:true});return{stopped:true};}fail('Process changed identity during shutdown. Refusing further action.');}}return fail('Owned app did not stop within four seconds. No process was killed.');}
 async stop(){return this.locked(async()=>{const manifest=this.manifest();return this.stopOwned(manifest!);});}
 async launch(){return this.locked(async()=>{const manifest=this.manifest()!;if(!manifest.active)fail('Install a release before launch.');const prior=this.running(manifest);if(prior){try{await this.authenticate(prior);return{url:prior.url,alreadyRunning:true};}catch{await this.stopOwned(manifest);}}
 const known=manifest.releases[manifest.active!]!;const base=within(this.root,`releases/${manifest.active}`);for(const[path,digest]of Object.entries(known.files))if(!existsSync(within(base,path))||hash(within(base,path))!==digest)fail(`Installed release modified or missing: ${path}`);
 const nonce=createHash('sha256').update(randomUUID()).digest('hex'),instanceId=randomUUID();const child=spawn(within(base,known.runtime),[within(base,known.entry)],{env:{...process.env,CAREERVISTA_ROOT:this.root,CAREERVISTA_PORT:'0',CAREERVISTA_INSTALLATION_ID:manifest.id,CAREERVISTA_INSTANCE_ID:instanceId,CAREERVISTA_CONTROL_NONCE:nonce},stdio:['ignore','pipe','pipe'],detached:true});let output='';const url=await new Promise<string>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Bundled app did not become ready within ten seconds.')),10000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',()=>{clearTimeout(timer);reject(new Error(`Bundled app failed to start. ${output.slice(-2000)}`));});child.stderr?.on('data',chunk=>{output=(output+String(chunk)).slice(-8000);});child.stdout?.on('data',chunk=>{output=(output+String(chunk)).slice(-8000);const match=/http:\/\/127\.0\.0\.1:\d+/.exec(output);if(match){clearTimeout(timer);resolve(match[0]);}});}).catch(error=>{child.kill('SIGTERM');throw error;});const item={installationId:manifest.id,instanceId,nonce,url,pid:child.pid!};try{await this.authenticate(item);atomic(join(this.root,'state','process.json'),item);}catch(error){child.kill('SIGTERM');throw error;}child.stdout?.destroy();child.stderr?.destroy();child.unref();return{url,alreadyRunning:false};
 });}
 storage(){this.manifest();const directories=disposable.map(kind=>{let bytes=0,skippedSymlinks=0;const files:{path:string;bytes:number;modifiedAt:number}[]=[];const walk=(path:string)=>{if(!existsSync(path))return;const stat=lstatSync(path);if(stat.isSymbolicLink()){skippedSymlinks++;return;}if(stat.isDirectory()){for(const name of readdirSync(path))walk(join(path,name));}else if(stat.isFile()){bytes+=stat.size;files.push({path:relative(this.root,path),bytes:stat.size,modifiedAt:stat.mtimeMs});}};walk(join(this.root,kind));return{kind,bytes,capBytes:(kind==='logs'?10:100)*1024*1024,maxAgeHours:kind==='temp'?24:168,skippedSymlinks,files};});return{directories,totalBytes:directories.reduce((sum,item)=>sum+item.bytes,0),protected:persistent,warning:'Persistent evidence, database, credentials and browser sessions are protected.'};}
 clearCache(options:{all?:boolean}={}){const inventory=this.storage();let reclaimedBytes=0;for(const directory of inventory.directories){let remaining=directory.bytes;for(const file of directory.files.sort((a,b)=>a.modifiedAt-b.modifiedAt)){if(options.all||Date.now()-file.modifiedAt>directory.maxAgeHours*3600000||remaining>directory.capBytes){const path=within(this.root,file.path);plain(path,false);if(existsSync(path)){const bytes=statSync(path).size;unlinkSync(path);reclaimedBytes+=bytes;remaining-=bytes;}}}}return{reclaimedBytes,...this.storage()};}
 private removeFiles(base:string,files:Record<string,string>){const retained:string[]=[];for(const[path,digest]of Object.entries(files)){const file=within(base,path);if(!existsSync(file))continue;plain(file,false);if(hash(file)===digest)unlinkSync(file);else retained.push(file);}const prune=(path:string)=>{if(!existsSync(path))return;plain(path,true);for(const name of readdirSync(path)){const child=join(path,name);const stat=lstatSync(child);if(stat.isSymbolicLink())retained.push(child);else if(stat.isDirectory())prune(child);else if(!retained.includes(child))retained.push(child);}if(!readdirSync(path).length)rmdirSync(path);};prune(base);return retained;}
 async registerSkills(host:'codex'|'agents'){return this.locked(async()=>{const manifest=this.manifest()!;if(!manifest.active||!['codex','agents'].includes(host))fail('Choose installed codex or agents skill host.');const root=join(homedir(),host==='codex'?'.codex':'.agents','skills');plain(root,true);mkdirSync(root,{recursive:true});const target=join(root,`careervista-${manifest.id}`);if(existsSync(target))fail('Owned skill directory already exists; refusing overwrite.');const known=manifest.releases[manifest.active!]!;const prefix='agent-skills/v1/careervista-capture/';const files:Record<string,string>=Object.fromEntries(Object.entries(known.files).filter(([path])=>path.startsWith(prefix)).map(([path,digest])=>[path.slice(prefix.length),digest]));if(!files['SKILL.md'])fail('Release has no packaged capture skill.');mkdirSync(target,{mode:0o700});try{for(const path of Object.keys(files)){const destination=join(target,path);mkdirSync(dirname(destination),{recursive:true});copyFileSync(within(join(this.root,'releases',manifest.active!),prefix+path),destination);}manifest.registrations.push({host,files});atomic(join(this.root,'state','installation.json'),manifest);return{registered:target};}catch(error){rmSync(target,{recursive:true,force:true});throw error;}});}
 async uninstall(options:{removeData?:boolean;confirmation?:string}={}){return this.locked(async()=>{const manifest=this.manifest(true);if(!manifest)return{keptData:true,retained:[],alreadyUninstalled:true};if(options.removeData&&options.confirmation!=='REMOVE_OWNED_DATA')fail('Confirm removal of owned data, credentials and sessions with --confirm REMOVE_OWNED_DATA. External backups/exports remain separate copies.');if(options.removeData)for(const name of persistent){const path=within(this.root,name);if(existsSync(path))treeNoLinks(path);}for(const[version,known]of Object.entries(manifest.releases))for(const path of Object.keys(known.files))within(within(this.root,`releases/${version}`),path);await this.stopOwned(manifest);const retained:string[]=[];for(const registration of manifest.registrations){const root=join(homedir(),registration.host==='codex'?'.codex':'.agents','skills');plain(root,true);const target=join(root,`careervista-${manifest.id}`);if(existsSync(target))retained.push(...this.removeFiles(target,registration.files));}manifest.registrations=[];for(const[version,known]of Object.entries(manifest.releases)){const base=within(this.root,`releases/${version}`);if(existsSync(base))retained.push(...this.removeFiles(base,known.files));}manifest.active=null;manifest.releases={};this.clearCache({all:true});for(const name of disposable){const path=within(this.root,name);if(existsSync(path)&&!readdirSync(path).length)rmdirSync(path);}if(options.removeData)for(const name of persistent){const path=within(this.root,name);if(existsSync(path)){treeNoLinks(path);rmSync(path,{recursive:true});}}atomic(join(this.root,'state','installation.json'),manifest);return{keptData:!options.removeData,retained:[...retained,...(!options.removeData?persistent.map(name=>join(this.root,name)):[])],warning:'External backup/export copies, normal browser profiles and shared software are not removed.'};});}
}
export function controlRoute(options:{installationId:string;instanceId:string;nonce:string;shutdown:()=>void}):ApiRoute{return async({request,url,json,send})=>{if(!url.pathname.startsWith('/api/v1/control/'))return false;if(request.headers.authorization!==`Bearer ${options.nonce}`)throw new AppError('Owned-process authorization required.',403,'forbidden');if(url.pathname==='/api/v1/control/status'&&request.method==='GET'){send({installationId:options.installationId,instanceId:options.instanceId});return true;}if(url.pathname==='/api/v1/control/shutdown'&&request.method==='POST'){const input=await json() as {installationId:string;instanceId:string};if(input?.installationId!==options.installationId||input?.instanceId!==options.instanceId)throw new AppError('Process identity mismatch.',403,'forbidden');send({stopping:true});setImmediate(options.shutdown);return true;}return false;};}
async function cli(){const [command,...args]=process.argv.slice(2);const option=(name:string)=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};const installation=new Installation(option('--root'));let result:unknown;switch(command){case'install':if(!option('--bundle'))fail('install requires --bundle.');result=await installation.install(option('--bundle')!);break;case'launch':result=await installation.launch();break;case'stop':result=await installation.stop();break;case'status':result=installation.status();break;case'storage':result=installation.storage();break;case'clear-cache':result=installation.clearCache({all:true});break;case'register-skills':result=await installation.registerSkills(option('--host') as 'codex'|'agents');break;case'uninstall':result=await installation.uninstall({removeData:args.includes('--remove-data'),confirmation:option('--confirm')});break;default:fail('Use install, launch, status, stop, storage, clear-cache, register-skills or uninstall.');}console.log(JSON.stringify(result,null,2));}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))void cli().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
