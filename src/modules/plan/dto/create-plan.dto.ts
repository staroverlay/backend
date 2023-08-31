import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, Length, MaxLength, Min } from 'class-validator';

@InputType()
export default class CreatePlanDTO {
  @Field()
  isDefault: boolean;

  @IsNotEmpty()
  @MaxLength(32)
  @Field(() => String)
  name: string;

  @Field()
  perkDesignLibrary: boolean;

  @Field()
  perkModChat: boolean;

  @Field()
  @Length(0, 100)
  maxEditors: number;

  @Field()
  @Length(0, 1024)
  maxStorageItems: number;

  @Field()
  @Min(0)
  maxStorageSize: number;

  @Field()
  @Length(0, 1024)
  maxWidgets: number;

  @Field()
  @Min(0)
  price: number;

  @Field()
  @Length(0, 100)
  discountYearly: number;
}
