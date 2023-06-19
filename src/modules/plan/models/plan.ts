import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@ObjectType()
@Schema()
export class Plan {
  @Field(() => ID)
  @Prop()
  _id: string;

  @Field()
  @Prop()
  isDefault: boolean;

  @Field()
  @Prop()
  name: string;

  @Field()
  @Prop()
  perkDesignLibrary: boolean;

  @Field()
  @Prop()
  perkModChat: boolean;

  @Field()
  @Prop()
  maxEditors: number;

  @Field()
  @Prop()
  maxStorageItems: number;

  @Field()
  @Prop()
  maxStorageSize: number;

  @Field()
  @Prop()
  maxWidgets: number;

  @Field()
  @Prop()
  price: number;

  @Field()
  @Prop()
  discountYearly: number;
}

export type PlanDocument = Plan & Document;
export const PlanSchema = SchemaFactory.createForClass(Plan);
