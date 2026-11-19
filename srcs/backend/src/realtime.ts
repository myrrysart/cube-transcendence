import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Server } from 'node:http';
import type { Socket } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import { Database } from './database';
import { Rooms } from './rooms';
import { Sessions } from './sessions';

type Client = { readonly socket: WebSocket; readonly roomId: string; readonly userId: string; readonly cookie: string; last: string; alive: boolean; heartbeatAt: number };

@Injectable()
export class Realtime implements OnModuleDestroy {
  constructor(private readonly db: Database, private readonly rooms: Rooms, private readonly sessions: Sessions) {}
  private readonly sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  private readonly clients = new Set<Client>();
  private readonly state = { stopped: false };
  private timer: ReturnType<typeof setTimeout> | undefined;

  attach(server: Server): void {
    server.on('upgrade', (req, socket: Socket, head) => {
      socket.on('error', () => socket.destroy());
      const url = new URL(req.url ?? '/', 'http://localhost');
      const roomId = url.searchParams.get('roomId');
      const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173';
      const reject = (status: number) => { socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`); };
      if (url.pathname !== '/api/events' || !roomId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(roomId) || req.headers.origin !== origin) { reject(403); return; }
      const cookie = req.headers.cookie ?? '';
      const authorize = async () => {
        const userId = await this.sessions.identify(cookie);
        if (!userId) { reject(401); return; }
        const room = await this.rooms.view(roomId, userId);
        if (!room.ok) { reject(403); return; }
        this.sockets.handleUpgrade(req, socket, head, ws => {
          const client: Client = { socket: ws, roomId, userId, cookie, last: '', alive: true, heartbeatAt: 0 };
          this.clients.add(client);
          ws.on('error', () => ws.terminate());
          // All game mutations use validated HTTP routes; this stream is server-to-client only.
          ws.on('message', () => ws.close(1008, 'Use HTTP actions.'));
          ws.on('pong', () => { client.alive = true; });
          ws.on('close', () => {
            this.clients.delete(client);
            if (![...this.clients].some(other => other.roomId === roomId && other.userId === userId)) {
              void this.db.roomParticipant.updateMany({ where: { roomId, userId }, data: { lastSeenAt: null, ready: false } }).catch(() => undefined);
            }
          });
          ws.send(JSON.stringify({ type: 'room.snapshot', room: room.data }));
        });
      };
      void authorize().catch(() => reject(503));
    });
    void this.tick().catch(() => this.fail());
  }

  private async tick(): Promise<void> {
    if (this.state.stopped) return;
    // Poll bounded room snapshots. The separate worker's committed result becomes the next update.
    const groups = new Map<string, Client[]>();
    for (const client of this.clients) groups.set(client.roomId, [...(groups.get(client.roomId) ?? []), client]);
    for (const [roomId, clients] of groups) {
      for (const client of clients) {
        if (!await this.sessions.identify(client.cookie)) { client.socket.close(1008, 'Session expired.'); continue; }
        if (Date.now() - client.heartbeatAt >= 10000) {
          if (!client.alive) { client.socket.terminate(); continue; }
          client.alive = false; client.heartbeatAt = Date.now(); client.socket.ping();
          await this.db.roomParticipant.updateMany({ where: { roomId, userId: client.userId }, data: { lastSeenAt: new Date() } });
        }
      }
      for (const client of clients) {
        const room = await this.rooms.view(roomId, client.userId);
        if (!room.ok) { client.socket.close(1008, 'Room membership ended.'); continue; }
        const payload = JSON.stringify({ type: 'room.snapshot', room: room.data });
        if (client.last !== payload && client.socket.readyState === WebSocket.OPEN) {
          if (client.socket.bufferedAmount > 2 * 1024 * 1024) { client.socket.close(1013, 'Reconnect to resume.'); continue; }
          client.socket.send(payload); client.last = payload;
        }
      }
    }
    if (!this.state.stopped) this.timer = setTimeout(() => { void this.tick().catch(() => this.fail()); }, 500);
  }

  private fail(): void {
    for (const client of this.clients) client.socket.close(1011, 'Reconnect to resume.');
    if (!this.state.stopped) this.timer = setTimeout(() => { void this.tick().catch(() => this.fail()); }, 1000);
  }

  onModuleDestroy(): void {
    this.state.stopped = true; clearTimeout(this.timer);
    for (const client of this.clients) client.socket.terminate();
    this.sockets.close();
  }
}
