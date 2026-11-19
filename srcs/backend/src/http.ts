import { Body, Controller, Get, HttpException, Param, ParseUUIDPipe, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Database } from './database';
import { validateDrawing } from './drawing';
import { Rounds, type Outcome } from './rounds';
import { Sessions } from './sessions';
import { Auth, validateCredentials } from './auth';
import { Rooms } from './rooms';

function response<T>(outcome: Outcome<T>): T {
  if (outcome.ok) return outcome.data;
  const statuses = { not_found: 404, duplicate: 409, closed: 409, challenge_unavailable: 503, full: 409, not_ready: 409, not_host: 403 } as const;
  throw new HttpException({ error: outcome.error }, statuses[outcome.error]);
}

@Controller()
export class HttpController {
  constructor(private readonly rounds: Rounds, private readonly sessions: Sessions, private readonly db: Database, private readonly auth: Auth, private readonly rooms: Rooms) {}

  @Get('health') health() { return { status: 'ok' }; }

  @Get('ready') async ready() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  }

  @Post('dev/session') async session(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (process.env.ENABLE_DEV_SESSION !== 'true' || process.env.NODE_ENV === 'production') {
      throw new HttpException({ error: 'development_sessions_disabled' }, 404);
    }

    const existingUserId = await this.sessions.identify(req.headers.cookie);

    if (existingUserId) {
      const user = await this.db.user.findUniqueOrThrow({ where: { id: existingUserId } });
      return { id: user.id, label: user.label, isGuest: !user.email };
    }

    const guest = await this.sessions.createGuest();

    res.cookie('cube_session', guest.token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/api',
      maxAge: 86400000,
    });

    return { id: guest.id, label: guest.label, isGuest: true };
  }

  @Post('auth/signup') async signup(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const input = validateCredentials(body, true);
    if (!input) throw new HttpException({ error: 'Use a valid email, a 15–128 character password and a 2–32 character display name.' }, 400);
    const created = await this.auth.signup(input);
    if (!created.ok) throw new HttpException({ error: created.error === 'busy' ? 'Please wait before trying again.' : 'Unable to create account with those details.' }, created.error === 'busy' ? 429 : 409);
    await this.sessions.revoke(req.headers.cookie);
    this.cookie(res, created.token);
    return created.account;
  }

  @Post('auth/login') async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const input = validateCredentials(body, false);
    if (!input) throw new HttpException({ error: 'Invalid email or password.' }, 400);
    const loggedIn = await this.auth.login(input);
    if (!loggedIn.ok) throw new HttpException({ error: loggedIn.error === 'busy' ? 'Please wait before trying again.' : 'Invalid email or password.' }, loggedIn.error === 'busy' ? 429 : 401);
    await this.sessions.revoke(req.headers.cookie);
    this.cookie(res, loggedIn.token);
    return loggedIn.account;
  }

  @Get('auth/me') async me(@Req() req: Request) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: await this.user(req) } });
    return { id: user.id, label: user.label, isGuest: !user.email };
  }

  @Post('auth/logout') async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revoke(req.headers.cookie);
    res.clearCookie('cube_session', { path: '/api', httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
    return { loggedOut: true };
  }

  @Post('rooms') async room(@Req() req: Request) { return response(await this.rooms.create(await this.user(req))); }

  @Get('rooms/:id') async roomView(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return response(await this.rooms.view(id, await this.user(req)));
  }

  @Post('rooms/:id/join') async join(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return response(await this.rooms.join(id, await this.user(req)));
  }

  @Post('rooms/:id/ready') async readyState(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request, @Body() body: unknown) {
    if (typeof body !== 'object' || body === null || Array.isArray(body) || Object.keys(body).length !== 1 || !('ready' in body) || typeof body.ready !== 'boolean') {
      throw new HttpException({ error: 'Expected only ready: boolean.' }, 400);
    }
    return response(await this.rooms.ready(id, await this.user(req), body.ready));
  }

  @Post('rooms/:id/start') async startRoom(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return response(await this.rooms.start(id, await this.user(req)));
  }

  @Post('rooms/:id/leave') async leave(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return response(await this.rooms.leave(id, await this.user(req)));
  }

  private cookie(res: Response, token: string): void {
    res.cookie('cube_session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api', maxAge: 86400000 });
  }

  @Post('rounds') async create(@Req() req: Request) {
    return response(await this.rounds.create(await this.user(req)));
  }

  @Get('rounds/:id') async prompt(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return response(await this.rounds.get(id, await this.user(req)));
  }

  @Post('rounds/:id/submission') async submit(
    @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request, @Body() body: unknown,
  ) {
    const receivedAt = new Date();
    const userId = await this.user(req);
    const drawing = validateDrawing(body);
    if (!drawing.ok) throw new HttpException({ error: drawing.error }, 400);
    return response(await this.rounds.submit(id, userId, drawing.data, receivedAt));
  }

  @Get('rounds/:id/result') async result(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return response(await this.rounds.result(id, await this.user(req)));
  }

  private async user(req: Request): Promise<string> {
    const userId = await this.sessions.identify(req.headers.cookie);
    if (!userId) throw new UnauthorizedException();
    return userId;
  }
}
