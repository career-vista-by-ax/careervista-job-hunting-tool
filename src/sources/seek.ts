import {AppError} from '../app.ts';
import type {CollectionAdapter} from '../collection.ts';
const hosts = new Set(['seek.com.au','www.seek.com.au','au.seek.com']);
export const seekAdapter: CollectionAdapter = {
 id:'seek', name:'SEEK Australia',
 searchUrl(keyword,config) { const url=new URL('https://www.seek.com.au/jobs');url.searchParams.set('keywords',keyword);if(config.location)url.searchParams.set('where',config.location);return url.href; },
 listingUrl(input) { const url=new URL(input);const match=/^\/job\/(\d+)(?:\/)?$/.exec(url.pathname);if(!hosts.has(url.hostname)||!match)throw new AppError('Use an observed official SEEK listing URL ending /job/<numeric ID>.');return `https://au.seek.com/job/${match[1]}`; },
 acceptsPage(input) { return hosts.has(new URL(input).hostname); }
};
