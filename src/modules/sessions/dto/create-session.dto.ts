import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty } from 'class-validator';

@InputType()
export default class CreateSessionDTO {
  @IsEmail()
  @Field(() => String)
  email: string;

  @IsNotEmpty()
  @Field(() => String)
  password: string;
}
