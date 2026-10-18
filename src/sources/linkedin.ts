import {AppError} from '../app.ts';
import type {CollectionAdapter} from '../collection.ts';
const official=(url:URL)=>url.hostname==='linkedin.com'||/^(www|[a-z]{2})\.linkedin\.com$/.test(url.hostname);
export const linkedinAdapter:CollectionAdapter={
 id:'linkedin',name:'LinkedIn',
 searchUrl(keyword,config){const url=new URL('https://www.linkedin.com/jobs/search/');url.searchParams.set('keywords',keyword);if(config.location)url.searchParams.set('location',config.location);return url.href;},
 listingUrl(input){const url=new URL(input),match=/^\/jobs\/view\/(?:[^/]+-)?(\d+)\/?$/.exec(url.pathname);if(!official(url)||!match)throw new AppError('Use an observed official LinkedIn /jobs/view/<numeric ID> listing URL.');return `https://www.linkedin.com/jobs/view/${match[1]}/`;},
 acceptsPage(input){return official(new URL(input));}
};
