import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@ObjectType()
@Schema()
export class MediaReward {
  @Field(() => ID)
  @Prop()
  _id: string;

  @Field()
  @Prop()
  rewardId: string;

  @Field()
  @Prop()
  mediaId: string;

  @Field()
  @Prop()
  widgetId: string;
}

export type MediaRewardDocument = MediaReward & Document;
export const MediaRewardSchema = SchemaFactory.createForClass(MediaReward);
