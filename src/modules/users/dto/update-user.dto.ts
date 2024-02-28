import { Field, InputType } from '@nestjs/graphql';
import { IsEmail } from 'class-validator';

@InputType()
export class UpdateUserDTO {
  @IsEmail()
  @Field(() => String, { nullable: true })
  email?: string;
}
