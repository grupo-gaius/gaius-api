import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayloadUser } from '../common/interfaces/jwt-payload-user.interface';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LogoutDto } from './dto/logout.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cadastrar usuário', description: 'Rota pública. Não exige Bearer token.' })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiConflictResponse({ description: 'E-mail já cadastrado' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  @ApiOperation({ summary: 'Login (access + refresh token)' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas' })
  @ApiTooManyRequestsResponse({ description: 'Máx. 10 tentativas / 15min por IP' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('google')
  @ApiOperation({
    summary: 'Login com Google',
    description:
      'Troca o idToken do Google por accessToken + refreshToken do Gaius. ' +
      'Cria o usuário se não existir; vincula googleSub se o e-mail já estiver cadastrado.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token Google inválido ou e-mail não verificado' })
  loginWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar tokens (rotação do refresh token)' })
  @ApiOkResponse({ type: RefreshResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token inválido ou expirado' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout (invalida access token e refresh token)' })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiUnauthorizedResponse()
  logout(@CurrentUser() user: JwtPayloadUser, @Body() dto: LogoutDto) {
    return this.authService.logout(user, dto);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar reset de senha por e-mail' })
  @ApiOkResponse({
    schema: { example: { ok: true } },
    description: 'Sempre retorna ok (não revela se o e-mail existe)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Redefinir senha com token' })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
