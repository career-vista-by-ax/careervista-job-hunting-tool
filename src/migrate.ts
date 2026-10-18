import {existsSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {CareerVistaApp} from './app.ts';
/** Installer subprocess: reject unknown newer schemas before applying bundled migrations. */
export function migrateInstallation(root:string){
 const path=join(root,'data','careervista.sqlite');
 if(existsSync(path)){
  const database=new DatabaseSync(path,{readOnly:true});
  try{
   const known=new Set(readdirSync(fileURLToPath(new URL('./migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')));
   if(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'").get()){
    const unknown=database.prepare('SELECT name FROM migrations').all().filter(row=>!known.has(String(row.name)));
    if(unknown.length)throw new Error('This database has newer or unknown migrations. Downgrade is refused.');
   }
   if(database.prepare('PRAGMA integrity_check').all().some(row=>row.integrity_check!=='ok'))throw new Error('Database integrity check failed.');
  }finally{database.close();}
 }
 const app=new CareerVistaApp({root});
 try{if(app.database.prepare('PRAGMA integrity_check').all().some(row=>row.integrity_check!=='ok')||app.database.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Migrated database integrity check failed.');}
 finally{app.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const index=process.argv.indexOf('--root');if(index<0||!process.argv[index+1])throw new Error('Migration requires an explicit private --root.');const tokenIndex=process.argv.indexOf('--start-token');
 if(tokenIndex>=0){const expected=process.argv[tokenIndex+1];let received='';process.stdin.setEncoding('utf8');for await(const chunk of process.stdin){received+=chunk;if(received.length>128)throw new Error('Invalid migration start token.');}if(!expected||received!==expected+'\n')throw new Error('Installer disconnected before authorizing migration.');}
 migrateInstallation(resolve(process.argv[index+1]!));
}
