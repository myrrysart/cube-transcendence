import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json, type Request, type Response, type NextFunction } from 'express';
import { AppModule } from './app';
import { Realtime } from './realtime';

export async function createApplication() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_SESSION === 'true') {
    throw new Error('Development sessions must be disabled in production.');
  }
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const allowedOrigins = (process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173')
      .split(',')
      .map((value) => value.trim());
    allowedOrigins.push('http://localhost:5173');
    if (origin && !allowedOrigins.includes(origin)) {
      res.status(403).json({ error: 'origin_not_allowed' });
      return;
    }
    next();
  });
  app.use(json({ limit: '2mb' }));
  const attempts = new Map<string, { count: number; until: number }>();
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!['/api/auth/signup', '/api/auth/login'].includes(req.path)) { next(); return; }
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    const key = req.socket.remoteAddress ?? 'local';
    const entry = attempts.get(key) ?? { count: 0, until: now + 60000 };
    attempts.set(key, entry); entry.count += 1;
    if (entry.count > 20) { res.status(429).json({ error: 'Please wait before trying again.' }); return; }
    next();
  });
  app.get(Realtime).attach(app.getHttpServer());
  app.enableShutdownHooks();
  return app;
}

async function main(): Promise<void> {
  const app = await createApplication();
  await app.listen(Number(process.env.APP_PORT ?? 3000), process.env.APP_HOST ?? '127.0.0.1');
}

if (require.main === module) void main().catch(() => { console.error('Backend startup failed; check database connectivity and configuration.'); process.exitCode = 1; });
