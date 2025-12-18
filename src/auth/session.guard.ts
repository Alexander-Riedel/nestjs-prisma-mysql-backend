import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class SessionGuard implements CanActivate {
    constructor(private readonly auth: AuthService) { }

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest<Request>();

        const sid = req.cookies?.sid;
        if (!sid) throw new UnauthorizedException('Not authenticated');

        const result = await this.auth.getUserFromSid(sid);
        if (!result) throw new UnauthorizedException('Not authenticated');

        // SessionGuard hängt user + session an req für Controller/weitere Guards
        // @ts-ignore
        req.user = {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
        };

        // @ts-ignore
        req.session = {
            sid,
            userId: result.user.id,
        };

        return true;
    }
}
