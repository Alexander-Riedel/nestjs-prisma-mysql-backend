import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
    imports: [
        ConfigModule,   // ConfigService verfügbar
        PrismaModule,   // Session-Tabelle (Prisma) nutzen
        UsersModule,    // UsersService nutzen
    ],
    controllers: [AuthController],
    providers: [AuthService],
})
export class AuthModule { }
