import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,readdirSync,lstatSync,existsSync,copyFileSync,chmodSync,renameSync,rmSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
function regular(path){if(!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink())throw new Error(`Package source must be a regular file: ${path}`);}
function copyTree(source,destination){if(lstatSync(source).isSymbolicLink())throw new Error(`Package source must not contain symlinks: ${source}`);if(lstatSync(source).isDirectory()){mkdirSync(destination,{recursive:true});for(const name of readdirSync(source).sort())copyTree(join(source,name),join(destination,name));}else{regular(source);mkdirSync(dirname(destination),{recursive:true});copyFileSync(source,destination);chmodSync(destination,0o644);}}
function filesIn(root,prefix=''){return readdirSync(join(root,prefix),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{const path=prefix?`${prefix}/${entry.name}`:entry.name;return entry.isDirectory()?filesIn(root,path):[path];});}
const launcher=`#!/bin/sh
set -eu
bundle="$(CDPATH= cd -P "$(/usr/bin/dirname "$0")" && pwd)"
exec "$bundle/runtime/node" "$bundle/app/dist/release-launcher.js" --bundle "$bundle" "$@"
`;
const readme=`CareerVista — private Mac release

1. Extract this archive into a folder you keep (Downloads is fine).
2. Double-click CareerVista.command to install and open your local workspace.
   You need no Node, mise, npm, Git, compiler, Docker or application account.
   Saved records and the first screen work without an internet connection.

On Apple Silicon Macs, this archive bundles Node 26.12.0, the application,
SQLite, local browser assets and versioned agent skills. It uses macOS's
normal browser; no browser/desktop shell or external agent host is bundled.

From Terminal in this extracted folder:
  ./CareerVista.command                  Install if needed, launch, open browser
  ./CareerVista.command --no-browser     Print the local URL without opening it
  ./CareerVista.command stop             Stop only the authenticated owned app
  ./CareerVista.command status           Show this installation's status
  ./CareerVista.command storage          Inspect disposable storage
  ./CareerVista.command clear-cache      Clear only owned disposable storage
  ./CareerVista.command uninstall        Keep evidence, credentials and sessions
  ./CareerVista.command install          Reinstall retained data after uninstall
  ./CareerVista.command upgrade          Install this release, keep data, reopen app

To upgrade, download and extract the newer release, then run its upgrade command
from the NEW extracted folder. Add --no-browser to print the URL instead.
Use the same --root if you chose a custom installation. No uninstall is needed.

Permanent owned-data removal is explicit:
  ./CareerVista.command uninstall --remove-data --confirm REMOVE_OWNED_DATA
Existing exported files, backup files and this extracted archive are separate
copies and are retained. Remove those yourself only when no longer needed.
Unknown or modified installation files are retained and reported.

Default root: ~/Library/Application Support/CareerVista
Use --root /absolute/path for a separate private copy. Each friend uses their
own root, database, credentials and host session. No administrator is needed.
Keep this extracted folder as your launch/uninstall tool. No shortcuts,
background launch agents or other external system settings are installed.

Optional agent setup (after local installation):
  ./CareerVista.command register-skills --host codex
or --host agents for a compatible filesystem-skills host. This creates only
an installation-owned skill directory and records it for safe uninstall.
Restart/reload your host's skills using its documented mechanism. Provide
that host with the local URL. The selected development host is Codex desktop
with its Chrome browser-control extension. Install that host/extension and
choose the model/provider using the host's own settings. Host software,
credentials and supported browser sessions remain with that host. Its license,
account, network and platform requirements are separate. CareerVista has no
account; reviewing saved evidence never requires a model or host. Website
passwords are entered directly on the website by you, never into this app.

First use:
  1. Register the skill above and reload your agent host's skills.
  2. Tell your agent your target role and the exact local browser URL. It
     expands related titles, clarifies your goals and confirms strengths
     from an optional PDF/Word/text resume using its own document tools.
  3. Agree preferences, source coverage, batch size and a spending cap in
     that conversation. The agent saves the approved profile/run, searches,
     analyses evidence and persists reasons, concerns and unknowns.
  4. Once the batch is ready, browse the jobs table and open role details.
     Return to your agent for refinements, decisions and further research.
     Agent setup on the page contains local backup/export/removal tools.

Starter prompt (replace the placeholder and example role):
  Use CareerVista at <LOCAL_URL> with the careervista-capture skill.
  Help me find principal analytics engineer roles in Australia. Expand related titles
  such as staff/lead roles and ask whether data leadership is in scope.
  Confirm my goals and competitive strengths, agree sources/limit/budget,
  then research and analyse in this agent. Save evidence, shortlist reasons,
  concerns and unknowns. When ready, send me to the webpage to browse.
  Do not submit applications or send messages.

Without host skill registration, give your agent this extracted folder's
agent-skills/v1/careervista-capture/SKILL.md and sibling instructions directly.
The agent needs browser tools and local HTTP access on the same computer.

Full READMEs: app/README.md (English), app/README.zh-CN.md (Simplified Chinese),
and app/README.zh-TW.md (Traditional Chinese).

Read app/docs/release.md for support and validation limitations, installation
recovery, upgrade restrictions, build provenance and privacy. This archive is
not notarized; real download/quarantine and clean-machine Finder launch remain
separate validation. Do not disable Gatekeeper or other protections globally.
No public distribution rights to the original application are granted.
`;
const windowsLauncher = '@echo off\r\nsetlocal\r\n"%~dp0runtime\\node.exe" "%~dp0app\\dist\\release-launcher.js" --bundle "%~dp0." %*\r\nset "cv_exit=%errorlevel%"\r\nif not "%cv_exit%"=="0" if "%~1"=="" pause\r\nexit /b %cv_exit%\r\n';
const windowsReadme = readme
 .replace('CareerVista — private Mac release','CareerVista — private Windows x64 release')
 .replaceAll('CareerVista.command','CareerVista.cmd')
 .replaceAll('./CareerVista.cmd', '.\\CareerVista.cmd')
 .replace('On Apple Silicon Macs, this archive bundles','On Windows x64, this archive bundles')
 .replace("It uses macOS's", "It uses Windows's")
 .replace('Default root: ~/Library/Application Support/CareerVista','Default root: %LOCALAPPDATA%\\CareerVista')
 .replace('No shortcuts,\nbackground launch agents or other external system settings are installed.','No shortcuts or background services are installed.')
 .replace('This archive is\nnot notarized; real download/quarantine and clean-machine Finder launch remain\nseparate validation. Do not disable Gatekeeper or other protections globally.', 'This Windows preview is not code-signed. Clean-machine Explorer launch and\nSmartScreen remain separate validation. Do not disable system protections.');
export async function packageRelease(options={}){
 const windows=process.platform==='win32'&&process.arch==='x64';
 if(!windows&&(process.platform!=='darwin'||process.arch!=='arm64'))throw new Error('Use a native macOS arm64 or Windows x64 builder. Other targets remain unverified.');
 const target=windows?'windows-x64':'macos-arm64',runtimeName=windows?'node.exe':'node',launcherName=windows?'CareerVista.cmd':'CareerVista.command';
 if(process.versions.node!=='26.12.0')throw new Error('Build with pinned Node 26.12.0.');
 if(!options.dist){const compiled=mkdtempSync(join(tmpdir(),'careervista-release-build-'));try{execFileSync(process.execPath,[join(projectRoot,'node_modules/typescript/bin/tsc'),'--outDir',compiled],{cwd:projectRoot});copyTree(join(projectRoot,'src/migrations'),join(compiled,'migrations'));for(const name of ['index.html','style.css'])copyTree(join(projectRoot,'src/public',name),join(compiled,'public',name));return await packageRelease({...options,dist:compiled});}finally{rmSync(compiled,{recursive:true,force:true});}}
 const runtimeRoot=resolve(options.runtimeRoot??(windows?dirname(process.execPath):dirname(dirname(process.execPath)))),dist=resolve(options.dist??join(projectRoot,'dist')),output=resolve(options.output??join(projectRoot,'release-artifacts'));
 const version=options.version??`0.1.0-${execFileSync('git',['rev-parse','--short=12','HEAD'],{cwd:projectRoot,encoding:'utf8'}).trim()}`;
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version)||version.includes('..'))throw new Error('Use a unique simple release version.');
 const runtime=windows?join(runtimeRoot,'node.exe'):join(runtimeRoot,'bin','node'),license=join(runtimeRoot,'LICENSE');regular(runtime);regular(license);
 const identity=JSON.parse(execFileSync(runtime,['-p','JSON.stringify({version:process.versions.node,platform:process.platform,arch:process.arch})'],{encoding:'utf8'}));
 if(identity.version!=='26.12.0'||identity.platform!==process.platform||identity.arch!==process.arch)throw new Error('Runtime must match this native builder and pinned Node 26.12.0.');
 const links=windows?[]:execFileSync('/usr/bin/otool',['-L',runtime],{encoding:'utf8'}).trim().split('\n').slice(1).map(line=>line.trim().split(' (')[0]);
 if(links.some(path=>!path.startsWith('/usr/lib/')&&!path.startsWith('/System/Library/')))throw new Error('Runtime has non-system dynamic libraries; bundle and validate them before release.');
 if(readFileSync(license,'utf8').length<10000)throw new Error('The complete Node license and third-party notices are required.');
 for(const name of ['main.js','lifecycle.js','release-launcher.js','public/client.js','public/index.html','public/style.css'])regular(join(dist,name));
 const name=`CareerVista-${version}-${target}`,directory=join(output,name),archive=join(output,`${name}.${windows?'zip':'tar.gz'}`);
 mkdirSync(output,{recursive:true});if(existsSync(directory)||existsSync(archive)||existsSync(`${archive}.sha256`))throw new Error('Release output exists. Choose a new version or empty output directory; existing artifacts are preserved.');
 const stage=join(output,`.stage-${randomUUID()}`),bundle=join(stage,name);mkdirSync(bundle,{recursive:true});
 try{
  copyTree(dist,join(bundle,'app','dist'));copyTree(join(projectRoot,'agent-skills'),join(bundle,'agent-skills'));mkdirSync(join(bundle,'app','docs'));for(const name of readdirSync(join(projectRoot,'docs')).filter(name=>name.endsWith('.md')&&name!=='implementation-status.md'))copyTree(join(projectRoot,'docs',name),join(bundle,'app','docs',name));
  for(const name of ['README.md','README.zh-CN.md','README.zh-TW.md'])copyTree(join(projectRoot,name),join(bundle,'app',name));
  mkdirSync(join(bundle,'runtime'));copyFileSync(runtime,join(bundle,'runtime',runtimeName));chmodSync(join(bundle,'runtime',runtimeName),0o755);copyFileSync(license,join(bundle,'runtime','LICENSE'));
  mkdirSync(join(bundle,'licenses'));for(const [source,target]of [['typescript/LICENSE','typescript-LICENSE'],['typescript/NOTICE.txt','typescript-NOTICE'],[`@typescript/typescript-${process.platform}-${process.arch}/LICENSE`,'typescript-platform-LICENSE'],[`@typescript/typescript-${process.platform}-${process.arch}/NOTICE.txt`,'typescript-platform-NOTICE'],['@types/node/LICENSE','types-node-LICENSE'],['undici-types/LICENSE','undici-types-LICENSE']])copyTree(join(projectRoot,'node_modules',source),join(bundle,'licenses',target));
  copyTree(join(projectRoot,'docs','references-and-licenses.md'),join(bundle,'licenses','references-and-licenses.md'));copyTree(join(projectRoot,'package-lock.json'),join(bundle,'licenses','build-dependency-lock.json'));
  const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:projectRoot,encoding:'utf8'}).trim();
  const dirty=Boolean(execFileSync('git',['status','--porcelain'],{cwd:projectRoot,encoding:'utf8'}).trim());
  const provenance={format:'careervista-release-provenance',version:1,createdAt:new Date().toISOString(),sourceRevision:revision,uncommittedChanges:dirty,target:`${process.platform}-${process.arch}`,runtime:{version:'26.12.0',source:'Native pinned Node distribution from the builder; source installation retained outside archive.',upstream:'https://nodejs.org/en/blog/release/v26.12.0',upstreamArchive:`https://nodejs.org/dist/v26.12.0/node-v26.12.0-${windows?'win':process.platform}-${process.arch}.${windows?'zip':'tar.gz'}`,binarySha256:sha(runtime),licenseSha256:sha(license),upstreamArchiveChecksumVerified:false,externalLibraries:links},build:{node:process.versions.node,dependencyLockSha256:sha(join(projectRoot,'package-lock.json')),productionNpmDependencies:[]},support:{core:'Native archive acceptance required for each target; not a clean-machine, Gatekeeper or SmartScreen proof.',browserAgent:'External host required; separately verified by workflow.'}};
  writeFileSync(join(bundle,'licenses','provenance.json'),JSON.stringify(provenance,null,2));writeFileSync(join(bundle,'app','package.json'),JSON.stringify({name:'careervista',version,type:'module',private:true}));
  writeFileSync(join(bundle,launcherName),windows?windowsLauncher:launcher,{mode:0o755});writeFileSync(join(bundle,'README.txt'),windows?windowsReadme:readme);
  const files=Object.fromEntries(filesIn(bundle).filter(path=>![launcherName,'README.txt'].includes(path)).map(path=>[path,sha(join(bundle,path))]));
  const release={format:'careervista-release',version,nodeVersion:'26.12.0',runtime:`runtime/${runtimeName}`,entry:'app/dist/main.js',files,archiveFiles:Object.fromEntries([launcherName,'README.txt'].map(path=>[path,sha(join(bundle,path))]))};writeFileSync(join(bundle,'release.json'),JSON.stringify(release,null,2));
  const temporaryArchive=join(stage,windows?'archive.zip':'archive.tar.gz');execFileSync(windows?'tar.exe':'/usr/bin/tar',windows?['-a','-cf',temporaryArchive,'-C',stage,name]:['-czf',temporaryArchive,'-C',stage,name],{env:{...process.env,COPYFILE_DISABLE:'1'},windowsHide:true});
  const archiveSha256=sha(temporaryArchive);renameSync(bundle,directory);renameSync(temporaryArchive,archive);writeFileSync(`${archive}.sha256`,`${archiveSha256}  ${name}.${windows?'zip':'tar.gz'}\n`);return{directory,archive,archiveSha256,version,sourceRevision:revision,uncommittedChanges:dirty};
 }finally{rmSync(stage,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=name=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
 void packageRelease({runtimeRoot:value('--runtime-root'),dist:value('--dist'),output:value('--output'),version:value('--version')}).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
