import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class RegisterResponseDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  email!: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
