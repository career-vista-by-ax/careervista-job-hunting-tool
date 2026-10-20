import { AppError } from './app.ts';
export interface ApplicationDetails {
  stage?: string; salaryAmount?: string; salaryCurrency?: string;
  salaryBasis?: string; salaryPeriod?: string; noticePeriod?: string;
  availableFrom?: string; workRights?: string;
  contacts?: { name: string; role: string; email: string; phone: string; notes: string }[];
  questions?: { question: string; answer: string }[];
}
export function validateDetails(input: unknown): ApplicationDetails {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Application details must be an object.');
  const value = input as Record<string, unknown>;
  const keys = ['stage','salaryAmount','salaryCurrency','salaryBasis','salaryPeriod','noticePeriod','availableFrom','workRights','contacts','questions'];
  if (Object.keys(value).some(key => !keys.includes(key))) throw new AppError('Use documented application detail fields.');
  for (const key of keys.filter(key => !['contacts','questions'].includes(key))) if (value[key] !== undefined && (typeof value[key] !== 'string' || (value[key] as string).length > 8000)) throw new AppError(`${key} must be text up to 8000 characters.`);
  if (value.salaryCurrency && !/^[A-Z]{3}$/.test(String(value.salaryCurrency))) throw new AppError('Use a three-letter currency such as AUD.');
  if (value.salaryBasis && !['base_excluding_super','package_including_super','other'].includes(String(value.salaryBasis))) throw new AppError('Select the salary base/super basis.');
  if (value.salaryPeriod && !['annual','daily','hourly','other'].includes(String(value.salaryPeriod))) throw new AppError('Select the original pay period.');
  for (const [key, fields, limit] of [['contacts',['name','role','email','phone','notes'],20],['questions',['question','answer'],50]] as const) {
    const rows = value[key]; if (rows === undefined) continue;
    if (!Array.isArray(rows) || rows.length > limit) throw new AppError(`${key} must contain at most ${limit} entries.`);
    for (const row of rows) if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(field => !(fields as readonly string[]).includes(field)) || fields.some(field => typeof row[field] !== 'string' || row[field].length > 8000)) throw new AppError(`Each ${key} entry must contain readable documented fields.`);
  }
  return JSON.parse(JSON.stringify(value)) as ApplicationDetails;
}
