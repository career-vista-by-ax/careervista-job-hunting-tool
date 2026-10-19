import {sparseRoutes} from './sparse.ts';
import {reassessmentRoutes} from './reassessment.ts';
import { feedbackRoutes } from './feedback.ts';
import { reconciliationRoutes } from './reconciliation.ts';
import {customSourceRoutes} from './custom-sources.ts';
import {companyRoutes} from './company.ts';
import { workspaceRoutes } from './workspace.ts';
import { collectionRoutes } from './collection.ts';
import { resumeVariantRoutes } from './resume-variants.ts';
import { resumeRoutes } from './resume.ts';
import { availabilityRoutes } from './availability.ts';
import { dataLifecycleRoutes } from './datalifecycle.ts';
import { controlRoute, defaultRoot } from './lifecycle.ts';
import { RunsService, runsRoute } from './runs.ts';
import { assessmentRoutes } from './assessments.ts';
import { compensationRoutes } from './compensation.ts';

import { ProfilesService, profileRoutes } from './profiles.ts';
import { resolve } from 'node:path';
import { CareerVistaApp } from './app.ts';
import { backupRoutes } from './backup.ts';
import { applicationRoutes } from './applications.ts';
import { startServer } from './server.ts';
import { extractionRoute } from './extraction.ts';

const root = resolve(process.env.CAREERVISTA_ROOT ?? defaultRoot());
const port = Number(process.env.CAREERVISTA_PORT ?? '4318');
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('CAREERVISTA_PORT must be an integer from 0 to 65535.');
const app = new CareerVistaApp({ root });
try {
  new RunsService(app).cleanupStorage();
  const server = await startServer(app, { port, routes: [sparseRoutes, reassessmentRoutes, feedbackRoutes, reconciliationRoutes, customSourceRoutes, companyRoutes, workspaceRoutes, collectionRoutes(), ...(process.env.CAREERVISTA_CONTROL_NONCE && process.env.CAREERVISTA_INSTALLATION_ID && process.env.CAREERVISTA_INSTANCE_ID ? [controlRoute({ installationId: process.env.CAREERVISTA_INSTALLATION_ID, instanceId: process.env.CAREERVISTA_INSTANCE_ID, nonce: process.env.CAREERVISTA_CONTROL_NONCE, shutdown: () => { process.emit('SIGTERM'); } })] : []), resumeVariantRoutes, resumeRoutes, availabilityRoutes, dataLifecycleRoutes, runsRoute, compensationRoutes, applicationRoutes, backupRoutes, profileRoutes(new ProfilesService(app)), extractionRoute, assessmentRoutes] });
  console.log(`CareerVista is ready: ${server.url}\nLocal data: ${app.paths.data}\nPress Ctrl+C to stop.`);
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
    if (stopping) return; stopping = true;
    void server.close().finally(() => { app.close(); process.exit(0); });
  });
} catch (error) { app.close(); throw error; }
