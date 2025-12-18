import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

function sha256(input: string) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class AuthService {
    private readonly cookieDomain: string | undefined;
    private readonly sessionTtlDays: number;
    private readonly csrfSecret: string;
    private readonly sessionSecret: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly users: UsersService,
        private readonly config: ConfigService,
    ) {
        const dom = this.config.get<string>('COOKIE_DOMAIN');
        this.cookieDomain = dom && dom.trim().length > 0 ? dom.trim() : undefined;

        this.sessionTtlDays = Number(this.config.get<string>('SESSION_TTL_DAYS', '7'));
        this.csrfSecret = this.config.get<string>('CSRF_SECRET', '');
        this.sessionSecret = this.config.get<string>('SESSION_SECRET', '');

        if (!this.csrfSecret || !this.sessionSecret) {
            throw new Error('CSRF_SECRET and SESSION_SECRET must be set in .env');
        }
    }

    // ---------- Register/Login ----------

    async register(email: string, password: string, name?: string) {
        const existing = await this.users.findByEmail(email);
        if (existing) throw new ForbiddenException('Email already in use');
        return this.users.create({ email, password, name });
    }

    async validateUser(email: string, password: string) {
        const user = await this.users.findByEmail(email);
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) throw new UnauthorizedException('Invalid credentials');

        return user;
    }

    // ---------- Session / Cookies ----------

    private setSidCookie(res: Response, sid: string) {
        // Host-only Cookie (kein "domain") => nur api.* erhält ihn
        res.cookie('sid', sid, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
        });
    }

    private clearSidCookie(res: Response) {
        res.clearCookie('sid', { path: '/' });
    }

    private issueCsrfToken(): string {
        const raw = crypto.randomBytes(32).toString('base64url');
        const sig = crypto.createHmac('sha256', this.csrfSecret).update(raw).digest('base64url');
        return `${raw}.${sig}`;
    }

    private setCsrfCookie(res: Response, token: string) {
        // CSRF Cookie muss von app.* gelesen werden können => Domain auf Root setzen
        res.cookie('csrf', token, {
            httpOnly: false,
            secure: true,
            sameSite: 'lax',
            path: '/',
            domain: this.cookieDomain,
        });
    }

    private clearCsrfCookie(res: Response) {
        res.clearCookie('csrf', {
            path: '/',
            domain: this.cookieDomain,
        });
    }

    verifyCsrf(token: string) {
        const parts = token.split('.');
        if (parts.length !== 2) return false;

        const [raw, sig] = parts;
        const expected = crypto.createHmac('sha256', this.csrfSecret).update(raw).digest('base64url');

        // timing-safe compare
        try {
            return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
        } catch {
            return false;
        }
    }

    async startSession(res: Response, userId: number) {
        const sid = crypto.randomBytes(32).toString('base64url');
        const sidHash = sha256(`${sid}.${this.sessionSecret}`);

        const expiresAt = new Date(Date.now() + this.sessionTtlDays * 24 * 60 * 60 * 1000);

        await this.prisma.session.create({
            data: {
                userId,
                sidHash,
                expiresAt,
            },
        });

        this.setSidCookie(res, sid);

        const csrf = this.issueCsrfToken();
        this.setCsrfCookie(res, csrf);
    }

    async rotateSession(res: Response, oldSid: string, userId: number) {
        const oldHash = sha256(`${oldSid}.${this.sessionSecret}`);

        await this.prisma.session.updateMany({
            where: { sidHash: oldHash, userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });

        await this.startSession(res, userId);
    }

    async endSession(res: Response, sid: string) {
        const sidHash = sha256(`${sid}.${this.sessionSecret}`);

        await this.prisma.session.updateMany({
            where: { sidHash, revokedAt: null },
            data: { revokedAt: new Date() },
        });

        this.clearSidCookie(res);
        this.clearCsrfCookie(res);
    }

    async getUserFromSid(sid: string) {
        const sidHash = sha256(`${sid}.${this.sessionSecret}`);

        const session = await this.prisma.session.findFirst({
            where: {
                sidHash,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
        });

        if (!session) return null;

        const user = await this.users.findById(session.userId);
        if (!user) return null;

        return { user, session };
    }
}
