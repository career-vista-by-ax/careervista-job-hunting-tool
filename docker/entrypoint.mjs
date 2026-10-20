import {mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {Installation} from './bundle/app/dist/lifecycle.js';
const root=process.env.CAREERVISTA_ROOT??'/var/lib/careervista/workspace';
// An OS-managed SQLite lock prevents two containers from using this volume at
// once and releases automatically even after an ungraceful container exit.
mkdirSync(join(dirname(root),'.container-state'),{recursive:true,mode:0o700});
const lock=new DatabaseSync(join(dirname(root),'.container-state/runtime-lock.sqlite'));
lock.exec('PRAGMA busy_timeout=3000; BEGIN EXCLUSIVE');
process.on('exit',()=>lock.close());
const installation=new Installation(root);
await installation.install('/opt/careervista/bundle');
const active=installation.status().active;
await import(pathToFileURL(join(root,'releases',active,'app/dist/main.js')).href);
