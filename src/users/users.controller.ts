import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/interfaces/jwt-payload-user.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil do usuário autenticado' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  async me(@CurrentUser() user: JwtPayloadUser) {
    const profile = await this.usersService.getProfileOrThrow(user.id);
    return plainToInstance(UserProfileDto, profile, {
      excludeExtraneousValues: true,
    });
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualizar perfil e preferências' })
  @ApiOkResponse({ type: UserProfileDto })
  @ApiUnauthorizedResponse()
  async updateMe(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: UpdateUserDto,
  ) {
    const profile = await this.usersService.updateProfile(user.id, dto);
    return plainToInstance(UserProfileDto, profile, {
      excludeExtraneousValues: true,
    });
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir conta (soft delete + cascata)' })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse()
  async deleteMe(@CurrentUser() user: JwtPayloadUser) {
    await this.usersService.softDelete(user.id);
  }
}
