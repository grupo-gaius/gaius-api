import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecret } from '../../common/config/jwt-secret';
import { JwtPayloadUser } from '../../common/interfaces/jwt-payload-user.interface';
import { UsersService } from '../../users/users.service';

interface JwtPayload {
  sub: string;
  jti?: string;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayloadUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status === UserStatus.BANNED) {
      throw new UnauthorizedException();
    }
    return { id: user.id, jti: payload.jti, exp: payload.exp };
  }
}
