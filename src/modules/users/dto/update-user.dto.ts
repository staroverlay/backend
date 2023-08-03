import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdateUserDTO {
  @IsEmail()
  @Field(() => String)
  email?: string;

  @MinLength(3)
  @MaxLength(64)
  @Field(() => String)
  username?: string;

  @MinLength(8)
  @MaxLength(256)
  @Field(() => String)
  password?: string;
}
