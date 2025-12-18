import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { CsrfGuard } from './csrf.guard';

/* ---------- DTOs (nur für Auth) ---------- */

class RegisterDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsOptional()
    @IsString()
    name?: string;
}

class LoginDto {
    @IsEmail()
    email: string;

    @IsString()
    password: string;
}

/* ---------- Controller ---------- */

@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) { }

    @Post('register')
    async register(
        @Body() dto: RegisterDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const user = await this.auth.register(dto.email, dto.password, dto.name);
        await this.auth.startSession(res, user.id);

        return {
            id: user.id,
            email: user.email,
            name: user.name,
        };
    }

    @Post('login')
    async login(
        @Body() dto: LoginDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        const user = await this.auth.validateUser(dto.email, dto.password);
        await this.auth.startSession(res, user.id);

        return {
            id: user.id,
            email: user.email,
            name: user.name,
        };
    }

    @UseGuards(SessionGuard)
    @Get('me')
    me(@Req() req: Request) {
        // SessionGuard hängt user an req
        // @ts-ignore
        return req.user;
    }

    @UseGuards(SessionGuard, CsrfGuard)
    @Post('refresh')
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        // @ts-ignore
        const { sid, userId } = req.session;
        await this.auth.rotateSession(res, sid, userId);
        return { ok: true };
    }

    @UseGuards(SessionGuard, CsrfGuard)
    @Post('logout')
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        // @ts-ignore
        const { sid } = req.session;
        await this.auth.endSession(res, sid);
        return { ok: true };
    }
}
