import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@ObjectType()
@Schema()
export class Media {
  @Field(() => ID)
  @Prop()
  _id: string;

  @Field()
  @Prop()
  name: string;

  @Field(() => ID)
  @Prop()
  resourceId: string;

  @Field()
  @Prop()
  size: number;

  @Field({ nullable: true })
  @Prop()
  type?: string;

  @Field({ nullable: true })
  @Prop()
  uploadId?: string;

  @Field()
  @Prop()
  userId: string;
}

export type MediaDocument = Media & Document;
export const MediaSchema = SchemaFactory.createForClass(Media);
