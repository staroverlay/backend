import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdateUserDTO {
  @IsEmail()
  @Field(() => String, { nullable: true })
  email?: string;

  @MinLength(3)
  @MaxLength(64)
  @Field(() => String, { nullable: true })
  username?: string;
}
