import { Field, InputType } from '@nestjs/graphql';
import { MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdatePasswordDTO {
  @Field(() => String)
  oldPassword: string;

  @MinLength(8)
  @MaxLength(256)
  @Field(() => String)
  newPassword: string;
}
