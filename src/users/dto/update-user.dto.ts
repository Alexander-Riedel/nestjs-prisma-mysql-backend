import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
    @ApiPropertyOptional({ example: 'test@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: 'Max Mustermann' })
    @IsOptional()
    @IsString()
    name?: string;
}