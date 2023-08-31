import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, MaxLength } from 'class-validator';

@InputType()
export default class CreateWidgetDTO {
  @IsNotEmpty()
  @MaxLength(64)
  @Field(() => String)
  displayName: string;

  @IsNotEmpty()
  @Field(() => String)
  template: string;

  // @IsNotEmpty()
  // @MaxLength(10000)
  // @Field(() => String, { nullable: true })
  // settings?: string;
}
