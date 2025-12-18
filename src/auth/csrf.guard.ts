import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class CsrfGuard implements CanActivate {
    constructor(private readonly auth: AuthService) { }

    canActivate(ctx: ExecutionContext): boolean {
        const req = ctx.switchToHttp().getRequest<Request>();

        const method = req.method.toUpperCase();

        // Lesezugriffe brauchen keinen CSRF-Schutz
        if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
            return true;
        }

        const cookieToken = req.cookies?.csrf;
        const headerToken = req.header('x-csrf');

        if (!cookieToken || !headerToken) {
            throw new ForbiddenException('CSRF token missing');
        }

        if (cookieToken !== headerToken) {
            throw new ForbiddenException('CSRF token mismatch');
        }

        if (!this.auth.verifyCsrf(cookieToken)) {
            throw new ForbiddenException('CSRF token invalid');
        }

        return true;
    }
}
