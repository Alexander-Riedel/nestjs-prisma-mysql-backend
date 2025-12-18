import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Für Login (AuthService)
   */
  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Für Session -> User Auflösung (AuthService)
   */
  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * User anlegen (Passwort wird gehasht gespeichert)
   */
  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: passwordHash,
      },
      // Passwort niemals zurückgeben
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });

    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        name: dto.name,
      },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
  }

  async remove(id: number) {
    // wenn du remove später wieder exposed: ok so.
    // im BFF-Setup ist das meist ein Admin-Usecase.
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User ${id} not found`);

    return this.prisma.user.delete({
      where: { id },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
  }
}
