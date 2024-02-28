import { Field, InputType } from '@nestjs/graphql';
import { Prop } from '@nestjs/mongoose';

@InputType()
export class UpdateProfileDTO {
  @Field(() => String)
  @Prop()
  displayName: string;
}
