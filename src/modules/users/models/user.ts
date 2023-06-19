import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@ObjectType()
@Schema()
export class User {
  @Field()
  @Prop()
  id: string;

  @Field()
  @Prop()
  avatar: string;

  @Field()
  @Prop({ default: false })
  isCreator: boolean;

  @Field()
  @Prop()
  email: string;

  @Field()
  @Prop()
  username: string;

  @Prop()
  accessToken: string;

  @Prop()
  refreshToken: string;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);
