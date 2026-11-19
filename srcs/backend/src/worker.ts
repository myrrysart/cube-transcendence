import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { setTimeout } from 'node:timers/promises';
import { WorkerModule } from './app';
import { Scoring } from './scoring';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  const worker = app.get(Scoring);
  const state = { running: true };
  process.once('SIGTERM', () => { state.running = false; });
  process.once('SIGINT', () => { state.running = false; });
  while (state.running) {
    const processed = await worker.processOne();
    if (!processed) await setTimeout(500);
  }
  await app.close();
}

void main().catch(() => { console.error('Scoring worker stopped unexpectedly; unfinished leases will expire for recovery.'); process.exitCode = 1; });
