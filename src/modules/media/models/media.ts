import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { FileType } from 'src/utils/file';

@ObjectType()
@Schema()
export class Media {
  @Field(() => ID)
  @Prop()
  _id: string;

  @Field()
  @Prop()
  displayName: string;

  @Field()
  @Prop()
  size: number;

  @Field({ nullable: true })
  @Prop({ type: String })
  type?: FileType;

  @Field()
  @Prop()
  userId: string;

  @Field({ nullable: true })
  @Prop()
  writeToken?: string;
}

export type MediaDocument = Media & Document;
export const MediaSchema = SchemaFactory.createForClass(Media);
