import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {Installation} from './lifecycle.ts';
/** Thin archive entry point: all installation ownership stays in the shared lifecycle. */
export async function releaseCommand(args: string[]) {
 const positional:string[]=[],values:Record<string,string>={},flags=new Set<string>();
 for(let i=0;i<args.length;i++){const arg=args[i]!;if(['--no-browser','--remove-data'].includes(arg)){flags.add(arg);continue;}if(['--root','--bundle','--host','--confirm'].includes(arg)){const value=args[++i];if(!value||value.startsWith('--'))throw new Error(`${arg} needs a value.`);values[arg]=value;continue;}if(arg.startsWith('-'))throw new Error(`Unknown option ${arg}. Use help.`);positional.push(arg);}
 if(positional.length>1)throw new Error('Choose one command. Use help.');
 const command=positional[0]??'open';if(command==='help')return{commands:['open','install','upgrade','launch','stop','status','storage','clear-cache','register-skills','uninstall'],default:'open installs if needed, launches, and opens your normal browser',upgrade:'Run upgrade from the newly extracted release folder. It installs that version, preserves saved data and opens the app; --no-browser prints its URL.',data:'uninstall keeps data; permanent removal requires --remove-data --confirm REMOVE_OWNED_DATA'};
 const launcher=process.platform==='win32'?'CareerVista.cmd':'CareerVista.command';
 const installation=new Installation(values['--root']??process.env.CAREERVISTA_ROOT),bundle=values['--bundle'];
 if(command==='install'||command==='open'||command==='upgrade'){
  if(!bundle)throw new Error(`The extracted release folder is required. Use ${launcher}.`);
  const incoming=JSON.parse(readFileSync(resolve(bundle,'release.json'),'utf8')) as {version:string};
  if(command==='install'||installation.status().active!==incoming.version)await installation.install(bundle);
  if(command==='install')return installation.status();
 }
 switch(command){
  case'open':case'upgrade':case'launch':{const result=await installation.launch();if(!flags.has('--no-browser')){if(process.platform==='win32')execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Start-Process -FilePath $env:CAREERVISTA_OPEN_URL'],{env:{...process.env,CAREERVISTA_OPEN_URL:result.url},windowsHide:true});else if(process.platform==='darwin')execFileSync('/usr/bin/open',[result.url]);else throw new Error(`Browser opening is unsupported on this platform. Open ${result.url} manually or use --no-browser.`);}return{...result,root:installation.root,agentSetup:`Optional: ${launcher} register-skills --host codex. External browser-capable host required; see README.txt.`};}
  case'stop':return installation.stop();case'status':return installation.status();case'storage':return installation.storage();case'clear-cache':return installation.clearCache({all:true});
  case'register-skills':return installation.registerSkills(values['--host'] as 'codex'|'agents');
  case'uninstall':return installation.uninstall({removeData:flags.has('--remove-data'),confirmation:values['--confirm']});
  default:throw new Error('Unknown command. Use help.');
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))void releaseCommand(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
