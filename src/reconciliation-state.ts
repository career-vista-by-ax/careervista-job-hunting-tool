import type {DatabaseSync} from 'node:sqlite';
/** Internal repository helper; original rows remain the source of all histories. */
export function vacancyIdentity(database:DatabaseSync,id:string) {
 const row=database.prepare('SELECT canonical_job_id FROM vacancy_members WHERE job_id=?').get(id);
 const canonicalId=row?String(row.canonical_job_id):id;
 const members=database.prepare('SELECT job_id FROM vacancy_members WHERE canonical_job_id=? ORDER BY job_id').all(canonicalId).map(row=>String(row.job_id));
 return {canonicalId,memberJobIds:members.length?members:[id]};
}
