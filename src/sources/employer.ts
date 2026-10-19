import { AppError } from '../app.ts';
import type { CollectionAdapter } from '../collection.ts';
/** Public employer/ATS snapshots collected by host tools; this adapter makes no requests. */
export const employerAdapter: CollectionAdapter = {
  id:'employer', name:'Public employer listings',
  searchUrl(_keyword,config) {
    if(!config.origin)throw new AppError('Choose the approved employer listing origin before planning discovery.');
    const url=new URL(config.origin);
    if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new AppError('Employer origin must be a credential-free HTTPS origin, without a path or query.');
    return url.origin;
  },
  listingUrl(input){const url=new URL(input);if(url.protocol!=='https:'||url.username||url.password)throw new AppError('Use a public HTTPS employer listing URL.');url.hash='';for(const key of [...url.searchParams.keys()])if(key.startsWith('utm_'))url.searchParams.delete(key);return url.href;},
  acceptsPage(input){return new URL(input).protocol==='https:';},
};
