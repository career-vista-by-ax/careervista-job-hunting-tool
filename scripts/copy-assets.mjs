import { cpSync } from 'node:fs';
cpSync('src/migrations', 'dist/migrations', { recursive: true });
for (const name of ['index.html', 'style.css']) cpSync(`src/public/${name}`, `dist/public/${name}`);
