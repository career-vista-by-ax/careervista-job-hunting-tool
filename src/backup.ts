import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';
import { AppError, CareerVistaApp } from './app.ts';
import type { ApiRoute } from './server.ts';

const format = 'careervista-private-backup';
export const maxBackupBytes = 128 * 1024 * 1024;
type Value = string | number | null;
interface TableData { columns: string[]; rows: Value[][] }
export interface Backup {
  format: typeof format; version: 1; createdAt: string;
  migrations: string[]; tables: Record<string, TableData>; checksum: string;
}
const quoted = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
// Credentials, sessions and disposable storage belong outside the domain DB. Fail closed
// rather than accidentally starting to include a newly introduced sensitive table.
const sensitive = /(?:^|_)(?:credentials?|secrets?|sessions?|tokens?|passwords?|caches?|logs?)(?:_|$)/i;
function tableNames(db: DatabaseSync): string[] {
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'migrations' ORDER BY name").all().map(row => String(row.name));
  if (tables.some(name => sensitive.test(name))) throw new AppError('Domain database contains a sensitive table. Move credentials/sessions outside the backup domain before making backups.', 409, 'unsafe_backup_schema');
  return tables;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function checksum(value: unknown) { return createHash('sha256').update(canonical(value)).digest('hex'); }
function migrations(db: DatabaseSync) { return db.prepare('SELECT name FROM migrations ORDER BY name').all().map(row => String(row.name)); }
function insert(db: DatabaseSync, tables: Record<string, TableData>) {
  for (const [name, table] of Object.entries(tables)) {
    const statement = db.prepare(`INSERT INTO ${quoted(name)} (${table.columns.map(quoted).join(',')}) VALUES (${table.columns.map(() => '?').join(',')})`);
    for (const row of table.rows) statement.run(...row as SQLInputValue[]);
  }
}
function assertRelations(db: DatabaseSync) {
  if (db.prepare('PRAGMA foreign_key_check').all().length) throw new AppError('Backup contains broken relationships.', 400, 'invalid_backup');
  if (db.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') throw new AppError('Backup contains invalid database records.', 400, 'invalid_backup');
}
/** Portable relational domain snapshots. No credentials/session/filesystem traversal. */
export class Backups {
  private app: CareerVistaApp;
  constructor(app: CareerVistaApp) { this.app = app; }
  create(): Backup {
    const db = this.app.database;
    db.exec('BEGIN');
    try {
      const tables: Record<string, TableData> = Object.create(null);
      for (const name of tableNames(db)) {
        const columns = db.prepare(`PRAGMA table_info(${quoted(name)})`).all().map(column => String(column.name));
        const rows = db.prepare(`SELECT ${columns.map(quoted).join(',')} FROM ${quoted(name)}`).all().map(row => columns.map(column => {
          const value = row[column];
          if (value !== null && typeof value !== 'string' && typeof value !== 'number') throw new AppError('Backup does not support binary domain columns. Add a versioned encoding before backing up this schema.', 409, 'unsupported_backup_schema');
          return value;
        }));
        tables[name] = { columns, rows };
      }
      const payload = { format: format as typeof format, version: 1 as const, createdAt: new Date().toISOString(), migrations: migrations(db), tables };
      const backup = { ...payload, checksum: checksum(payload) };
      if (Buffer.byteLength(JSON.stringify(backup)) > maxBackupBytes) throw new AppError('Backup exceeds the supported 128 MiB portable backup limit.', 413, 'backup_too_large');
      db.exec('COMMIT'); return backup;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  restore(input: unknown) {
    // Validate against locally trusted migrations in a separate database BEFORE any
    // destination transaction. Backup input never supplies executable SQL or paths.
    const validated = this.validate(input);
    const db = this.app.database;
    db.exec('BEGIN IMMEDIATE');
    try {
      if (tableNames(db).some(name => Number(db.prepare(`SELECT count(*) AS count FROM ${quoted(name)}`).get()?.count) > 0)) throw new AppError('Restore requires an empty installation. Choose a separate installation root; existing records are never overwritten.', 409, 'restore_requires_empty');
      db.exec('PRAGMA defer_foreign_keys = ON');
      insert(db, validated.tables);
      assertRelations(db);
      db.exec('COMMIT');
      return { restored: true, tables: Object.keys(validated.tables).length, records: Object.values(validated.tables).reduce((total, table) => total + table.rows.length, 0), reconfigure: ['Model credentials are excluded: configure providers again if needed.', 'Browser sessions are excluded: sign in to source websites again.', 'Document references are retained; external files must be copied separately.'] };
    } catch (error) { db.exec('ROLLBACK'); if (error instanceof AppError) throw error; throw new AppError('Backup records are incompatible with this installation. No data was restored.', 400, 'invalid_backup'); }
  }
  private validate(input: unknown): Backup {
    const bad = (message: string): never => { throw new AppError(message, 400, 'invalid_backup'); };
    if (!input || typeof input !== 'object' || Array.isArray(input)) bad('Select a CareerVista backup JSON object.');
    const value = input as Backup;
    if (value.format !== format || value.version !== 1) bad('Unsupported backup format or version. Use a compatible CareerVista release.');
    if (Object.keys(value).sort().join(',') !== 'checksum,createdAt,format,migrations,tables,version') bad('Backup envelope contains unexpected or missing fields.');
    if (typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) bad('Backup capture time is invalid.');
    if (typeof value.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(value.checksum)) bad('Backup checksum is missing or invalid.');
    const { checksum: recorded, ...payload } = value;
    if (checksum(payload) !== recorded) bad('Backup checksum does not match. The file may be damaged or edited.');
    const localMigrations = migrations(this.app.database);
    if (!Array.isArray(value.migrations) || !value.migrations.length || value.migrations.length > localMigrations.length || value.migrations.some(name => typeof name !== 'string' || !localMigrations.includes(name)) || localMigrations.filter(name => value.migrations.includes(name)).join('\0') !== value.migrations.join('\0')) bad('Backup schema is unsupported. Restore with the same or a newer compatible release.');
    if (!value.tables || typeof value.tables !== 'object' || Array.isArray(value.tables)) bad('Backup tables must be an object.');
    const validation = new DatabaseSync(':memory:');
    try {
      validation.exec('PRAGMA foreign_keys = ON');
      for (const name of value.migrations) validation.exec(readFileSync(new URL(`./migrations/${name}`, import.meta.url), 'utf8'));
      const expected = tableNames(validation);
      if (Object.keys(value.tables).sort().join('\0') !== expected.join('\0')) bad('Backup is missing domain tables or contains unknown tables.');
      for (const name of expected) {
        const table = value.tables[name]!;
        const columns = validation.prepare(`PRAGMA table_info(${quoted(name)})`).all();
        if (!table || Object.keys(table).sort().join(',') !== 'columns,rows' || !Array.isArray(table.columns) || table.columns.join('\0') !== columns.map(column => column.name).join('\0') || !Array.isArray(table.rows)) bad(`Backup table ${name} has an incompatible schema.`);
        for (const row of table.rows) {
          if (!Array.isArray(row) || row.length !== columns.length) bad(`Backup table ${name} has a malformed row.`);
          row.forEach((cell, index) => {
            const column = columns[index]!; const type = String(column.type).toUpperCase();
            if (cell === null) { if (Number(column.notnull) || Number(column.pk)) bad(`Backup ${name}.${column.name} cannot be null.`); return; }
            if (type.includes('INT') ? typeof cell !== 'number' || !Number.isSafeInteger(cell) : type.includes('TEXT') ? typeof cell !== 'string' : typeof cell !== 'number' || !Number.isFinite(cell)) bad(`Backup ${name}.${column.name} has an invalid value type.`);
            if (String(column.name).endsWith('_json') && typeof cell === 'string') { try { JSON.parse(cell); } catch { bad(`Backup ${name}.${column.name} contains invalid JSON.`); } }
          });
        }
      }
      validation.exec('BEGIN; PRAGMA defer_foreign_keys = ON');
      insert(validation, value.tables); assertRelations(validation); validation.exec('COMMIT');
      return value;
    } catch (error) { if (error instanceof AppError) throw error; return bad('Backup contains invalid records, constraints or relationships. No data was restored.'); }
    finally { validation.close(); }
  }
}
export const backupRoutes: ApiRoute = async ({ app, request, url, json, send }) => {
  if (url.pathname === '/api/v1/backup' && request.method === 'GET') { send(new Backups(app).create()); return true; }
  if (url.pathname === '/api/v1/backup/restore' && request.method === 'POST') { send(new Backups(app).restore(await json(maxBackupBytes))); return true; }
  return false;
};
