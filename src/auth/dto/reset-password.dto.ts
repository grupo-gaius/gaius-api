import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recebido por e-mail' })
  @IsString()
  @MinLength(20)
  token!: string;

  @ApiProperty({ example: 'novaSenha12345', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
