import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, Max, Min } from 'class-validator';

@InputType()
export class CreateUserDTO {
  @IsEmail()
  @Field(() => String)
  email: string;

  @Min(3)
  @Max(64)
  @Field(() => String)
  username: string;

  @Min(8)
  @Max(256)
  @Field(() => String)
  password: string;
}
