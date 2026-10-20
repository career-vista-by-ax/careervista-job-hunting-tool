import {mkdirSync,copyFileSync,readdirSync,readFileSync,writeFileSync,lstatSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root='/opt/careervista/bundle';
const version=process.env.CAREERVISTA_IMAGE_VERSION;
if(!version||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version)||version.includes('..'))throw new Error('Use a unique image release version.');
if(process.versions.node!=='26.12.0')throw new Error('Container must use pinned Node 26.12.0.');
mkdirSync(join(root,'runtime'),{recursive:true});
copyFileSync(process.execPath,join(root,'runtime/node'));
copyFileSync('/usr/local/LICENSE',join(root,'runtime/LICENSE'));
const files={};
function walk(path){for(const name of readdirSync(path)){const file=join(path,name),stat=lstatSync(file);if(stat.isSymbolicLink())throw new Error('Bundle cannot contain symlinks.');if(stat.isDirectory())walk(file);else files[relative(root,file).replaceAll('\\','/')]=createHash('sha256').update(readFileSync(file)).digest('hex');}}
walk(root);
writeFileSync(join(root,'release.json'),JSON.stringify({format:'careervista-release',version,nodeVersion:'26.12.0',runtime:'runtime/node',entry:'app/dist/main.js',files},null,2));
