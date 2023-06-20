import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@ObjectType()
@Schema()
export class Media {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop()
  name: string;

  @Field()
  @Prop()
  resourceId: string;

  @Field()
  @Prop()
  size: number;

  @Field()
  @Prop()
  type: string;

  @Field({ nullable: true })
  @Prop()
  uploadId?: string;

  @Field()
  @Prop()
  userId: string;
}

export type MediaDocument = Media & Document;
export const MediaSchema = SchemaFactory.createForClass(Media);
