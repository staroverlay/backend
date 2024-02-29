import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, MaxLength, MinLength } from 'class-validator';

@InputType()
export class CreateUserDTO {
  @IsEmail()
  @Field(() => String)
  email: string;

  @MinLength(8)
  @MaxLength(256)
  @Field(() => String)
  password: string;
}
