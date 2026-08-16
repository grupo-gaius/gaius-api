import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayloadUser } from '../common/interfaces/jwt-payload-user.interface';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_RESET_TTL_SECONDS = 60 * 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    const googleClientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(googleClientId);
    if (googleClientId) {
      this.logger.log('GOOGLE_CLIENT_ID ok — POST /auth/google habilitado');
    } else {
      this.logger.warn(
        'GOOGLE_CLIENT_ID ausente — POST /auth/google vai responder 400',
      );
    }
  }

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      passwordHash,
    });
    return plainToInstance(RegisterResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  private refreshKey(userId: string) {
    return `refresh_token:${userId}`;
  }

  private refreshLookupKey(refreshTokenHash: string) {
    return `refresh_token_lookup:${refreshTokenHash}`;
  }

  private blacklistKey(jti: string) {
    return `token:blacklist:${jti}`;
  }

  private passwordResetKey(tokenHash: string) {
    return `password_reset:${tokenHash}`;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const jti = randomUUID();
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, jti },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenHash = this.hashToken(refreshToken);

    await this.redis.raw
      .multi()
      .set(this.refreshKey(userId), refreshTokenHash, 'EX', REFRESH_TOKEN_TTL_SECONDS)
      .set(
        this.refreshLookupKey(refreshTokenHash),
        userId,
        'EX',
        REFRESH_TOKEN_TTL_SECONDS,
      )
      .exec();

    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.issueTokens(user.id);
    return plainToInstance(LoginResponseDto, tokens, {
      excludeExtraneousValues: true,
    });
  }

  async loginWithGoogle(dto: GoogleLoginDto): Promise<LoginResponseDto> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new BadRequestException('Google login is not configured');
    }

    let payload: {
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      name?: string;
      picture?: string;
    };
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: clientId,
      });
      payload = ticket.getPayload() ?? {};
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    const googleSub = payload.sub;
    const email = payload.email?.toLowerCase();
    const emailVerified =
      payload.email_verified === true || payload.email_verified === 'true';

    if (!googleSub || !email || !emailVerified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    let user = await this.usersService.findByGoogleSub(googleSub);
    if (!user) {
      const byEmail = await this.usersService.findByEmail(email);
      if (byEmail) {
        user = await this.usersService.linkGoogle(byEmail.id, {
          googleSub,
          avatarUrl: payload.picture ?? null,
          name: payload.name,
        });
      } else {
        user = await this.usersService.create({
          name: payload.name?.trim() || email.split('@')[0],
          email,
          passwordHash: null,
          googleSub,
          avatarUrl: payload.picture ?? null,
        });
      }
    }

    await this.usersService.updateLastLogin(user.id);
    const tokens = await this.issueTokens(user.id);
    return plainToInstance(LoginResponseDto, tokens, {
      excludeExtraneousValues: true,
    });
  }

  async refresh(dto: RefreshDto): Promise<RefreshResponseDto> {
    const tokenHash = this.hashToken(dto.refreshToken);
    const userId = await this.redis.raw.get(this.refreshLookupKey(tokenHash));
    if (!userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const storedHash = await this.redis.raw.get(this.refreshKey(userId));
    if (!storedHash || storedHash !== tokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.redis.raw.del(this.refreshLookupKey(tokenHash));
    const tokens = await this.issueTokens(userId);
    return plainToInstance(RefreshResponseDto, tokens, {
      excludeExtraneousValues: true,
    });
  }

  async logout(user: JwtPayloadUser, dto: LogoutDto): Promise<{ ok: true }> {
    if (user.jti && user.exp) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const ttl = Math.max(0, user.exp - nowSeconds);
      if (ttl > 0) {
        await this.redis.raw.set(this.blacklistKey(user.jti), '1', 'EX', ttl);
      }
    }

    const refreshKey = this.refreshKey(user.id);
    const storedHash = await this.redis.raw.get(refreshKey);
    if (storedHash) {
      await this.redis.raw
        .multi()
        .del(refreshKey)
        .del(this.refreshLookupKey(storedHash))
        .exec();
    }

    if (dto.refreshToken) {
      const tokenHash = this.hashToken(dto.refreshToken);
      await this.redis.raw.del(this.refreshLookupKey(tokenHash));
    }
    return { ok: true };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ ok: true }> {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (!user) {
      return { ok: true };
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    await this.redis.raw.set(
      this.passwordResetKey(tokenHash),
      user.id,
      'EX',
      PASSWORD_RESET_TTL_SECONDS,
    );
    await this.mail.sendPasswordResetEmail(user.email, token);
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ ok: true }> {
    const tokenHash = this.hashToken(dto.token);
    const userId = await this.redis.raw.get(this.passwordResetKey(tokenHash));
    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.usersService.updatePassword(userId, passwordHash);
    await this.redis.raw.del(this.passwordResetKey(tokenHash));
    await this.redis.raw.del(this.refreshKey(userId));

    return { ok: true };
  }
}
