import { Module } from '@nestjs/common';
import { Database } from './database';
import { HttpController } from './http';
import { Rounds } from './rounds';
import { Scoring } from './scoring';
import { Sessions } from './sessions';
import { Auth } from './auth';
import { Rooms } from './rooms';
import { Realtime } from './realtime';

@Module({ controllers: [HttpController], providers: [Database, Rounds, Sessions, Auth, Rooms, Realtime] })
export class AppModule {}

@Module({ providers: [Database, Scoring] })
export class WorkerModule {}
