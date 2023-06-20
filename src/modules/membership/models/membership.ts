import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@ObjectType()
@Schema()
export class Membership {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop()
  userId: string;

  @Field()
  @Prop()
  planId: string;

  @Field()
  @Prop()
  startDate: Date;

  @Field()
  @Prop()
  endDate: Date;
}

export type MembershipDocument = Membership & Document;
export const MembershipSchema = SchemaFactory.createForClass(Membership);
