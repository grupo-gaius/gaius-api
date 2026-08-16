import { Injectable, NotFoundException } from '@nestjs/common';
import { PreferredCurrency, Prisma, User, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_CACHE_TTL = 60 * 5;

type UserWithPreferences = Prisma.UserGetPayload<{
  include: { preferences: true };
}>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private userCacheKey(id: string) {
    return `user:${id}`;
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash?: string | null;
    googleSub?: string | null;
    avatarUrl?: string | null;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash ?? null,
        googleSub: data.googleSub ?? null,
        avatarUrl: data.avatarUrl ?? null,
        preferences: { create: {} },
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { googleSub, deletedAt: null },
    });
  }

  async linkGoogle(
    id: string,
    data: { googleSub: string; avatarUrl?: string | null; name?: string },
  ): Promise<User> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        googleSub: data.googleSub,
        ...(data.avatarUrl && !existing.avatarUrl
          ? { avatarUrl: data.avatarUrl }
          : {}),
        ...(data.name && !existing.name ? { name: data.name } : {}),
      },
    });
    await this.invalidateCache(id);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async getProfileOrThrow(id: string): Promise<UserWithPreferences> {
    const cached = await this.redis.raw.get(this.userCacheKey(id));
    if (cached) {
      return JSON.parse(cached) as UserWithPreferences;
    }

    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { preferences: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.redis.raw.set(
      this.userCacheKey(id),
      JSON.stringify(user),
      'EX',
      USER_CACHE_TTL,
    );
    return user;
  }

  async invalidateCache(id: string) {
    await this.redis.raw.del(this.userCacheKey(id));
  }

  async updateLastLogin(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
    await this.invalidateCache(id);
  }

  async updateProfile(
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserWithPreferences> {
    const { theme, defaultCurrency, notificationsEnabled, ...userFields } = dto;

    const preferencesData: Prisma.UserPreferencesUpdateInput = {};
    if (theme !== undefined) preferencesData.theme = theme;
    if (defaultCurrency !== undefined) {
      preferencesData.defaultCurrency = defaultCurrency;
    }
    if (notificationsEnabled !== undefined) {
      preferencesData.notificationsEnabled = notificationsEnabled;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...userFields,
        ...(Object.keys(preferencesData).length > 0 && {
          preferences: { update: preferencesData },
        }),
      },
      include: { preferences: true },
    });

    await this.invalidateCache(id);
    return user;
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: UserStatus.SUSPENDED,
      },
    });
    await this.invalidateCache(id);
    await this.redis.raw.del(`refresh_token:${id}`);
  }

  async updatePassword(id: string, passwordHash: string) {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    await this.invalidateCache(id);
  }
}
